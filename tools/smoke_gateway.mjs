// Local production smoke proxy only; production uses the supplied nginx/hosting gateway.
import http from "node:http";
const server = http.createServer((request, response) => {
  const port = request.url.startsWith("/api/") ? 8000 : 3001;
  const upstream = http.request({ hostname: "127.0.0.1", port, path: request.url, method: request.method, headers: request.headers }, (incoming) => {
    response.writeHead(incoming.statusCode, incoming.headers);
    incoming.pipe(response);
  });
  upstream.on("error", () => { response.writeHead(502); response.end("Local upstream is not ready"); });
  request.pipe(upstream);
});
server.listen(3002, "127.0.0.1", () => console.log("Local production smoke gateway: http://127.0.0.1:3002"));
