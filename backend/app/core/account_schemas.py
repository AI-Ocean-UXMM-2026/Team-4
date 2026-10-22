import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmailInput(StrictInput):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class BusinessInput(StrictInput):
    name: str = Field(min_length=1, max_length=200)
    industry: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=40)
    address: str = Field(default="", max_length=500)
    currency: Literal["MMK"] = "MMK"

    @field_validator("name", "industry", "city", "phone", "address", mode="before")
    @classmethod
    def clean_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        if value and not re.fullmatch(r"[+\d() .-]{5,40}", value):
            raise ValueError("Enter a valid business phone number")
        return value


class Registration(EmailInput):
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)
    business: BusinessInput

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class Onboarding(BusinessInput):
    full_name: str = Field(min_length=1, max_length=120)

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ProfileUpdate(StrictInput):
    full_name: str = Field(min_length=1, max_length=120)
    business: BusinessInput | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return value.strip() if isinstance(value, str) else value


def check_password(password, settings):
    from .errors import APIError
    checks = {"lower": r"[a-z]", "upper": r"[A-Z]", "number": r"[0-9]", "symbol": r"[^A-Za-z0-9\s]"}
    if len(password) < settings.password_min_length or any(not re.search(checks[k], password) for k in filter(None, settings.password_required_characters.split(","))):
        raise APIError(400, "PASSWORD_WEAK", "Password does not meet the displayed requirements.")
