import ipaddress
import socket
from urllib.parse import quote, urlparse

import httpx

from ...core.errors import APIError


def check_response(response):
    if response.status_code in (401, 403):
        raise APIError(401, "GRAPH_RECONNECT", "Microsoft file access expired or was denied. Reconnect OneDrive.")
    if response.status_code == 404:
        raise APIError(404, "WORKBOOK_NOT_FOUND", "Linked workbook was moved, deleted, or is inaccessible.")
    if response.status_code == 429:
        retry = response.headers.get("Retry-After", "60")
        raise APIError(429, "GRAPH_THROTTLED", "OneDrive is busy. Try again later.", headers={"Retry-After": retry if retry.isdigit() else "60"})
    if response.status_code >= 400:
        raise APIError(503, "GRAPH_UNAVAILABLE", "OneDrive is temporarily unavailable. Your imported data is unchanged.")


class GraphClient:
    def __init__(self, token, max_bytes, transport=None):
        self.max_bytes = max_bytes
        self.client = httpx.Client(base_url="https://graph.microsoft.com/v1.0/", timeout=30,
                                   headers={"Authorization": "Bearer " + token}, transport=transport)

    def close(self):
        self.client.close()

    def get(self, path, **kwargs):
        try:
            response = self.client.get(path, **kwargs)
            check_response(response)
            return response
        except httpx.RequestError:
            raise APIError(503, "GRAPH_UNAVAILABLE", "Cannot reach OneDrive. Your imported data is unchanged.") from None

    def path(self, drive_id, item_id):
        return f"drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}"

    def metadata(self, drive_id, item_id):
        return self.get(self.path(drive_id, item_id), params={"$select": "id,name,eTag,size,file,parentReference"}).json()

    def list_files(self, folder_id=None):
        path = "me/drive/root/children" if not folder_id else "me/drive/items/" + quote(folder_id, safe="") + "/children"
        result = []
        while path:
            data = self.get(path, params={"$select": "id,name,file,folder,parentReference", "$top": "200"}).json()
            for item in data.get("value", []):
                if "folder" in item or item.get("name", "").lower().endswith(".xlsx"):
                    result.append({"id": item["id"], "name": item["name"], "is_folder": "folder" in item,
                                   "drive_id": item.get("parentReference", {}).get("driveId")})
            path = data.get("@odata.nextLink")
            if path and not path.startswith("https://graph.microsoft.com/v1.0/"):
                raise APIError(503, "GRAPH_UNAVAILABLE", "Unexpected Microsoft paging response.")
            if len(result) >= 2000:
                break
        return result

    def download(self, drive_id, item_id):
        response = self.get(self.path(drive_id, item_id) + "/content")
        if response.status_code == 200:
            if len(response.content) > self.max_bytes:
                raise APIError(400, "FILE_TOO_LARGE", "Workbook exceeds the upload size limit.")
            return response.content
        target = urlparse(response.headers.get("Location", ""))
        if target.scheme != "https" or not target.hostname or target.username or target.password:
            raise APIError(503, "GRAPH_UNAVAILABLE", "OneDrive returned an invalid download location.")
        try:
            if any(not ipaddress.ip_address(entry[4][0]).is_global for entry in socket.getaddrinfo(target.hostname, 443)):
                raise APIError(503, "GRAPH_UNAVAILABLE", "OneDrive returned an invalid download host.")
            # New client sends NO Microsoft bearer header to the preauthenticated URL.
            with httpx.stream("GET", target.geturl(), timeout=30, follow_redirects=False) as stream:
                check_response(stream)
                if stream.status_code != 200:
                    raise APIError(503, "GRAPH_UNAVAILABLE", "Unexpected download response. Retry sync.")
                data = bytearray()
                for chunk in stream.iter_bytes():
                    data.extend(chunk)
                    if len(data) > self.max_bytes:
                        raise APIError(400, "FILE_TOO_LARGE", "Workbook exceeds the upload size limit.")
                return bytes(data)
        except (httpx.RequestError, OSError):
            raise APIError(503, "GRAPH_UNAVAILABLE", "OneDrive download failed. Try Sync Now again.") from None
