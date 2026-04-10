from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    nickname: str = Field(min_length=1, max_length=128)
    region_id: int
    city_id: int


class RegisterOut(BaseModel):
    id: int
    email: str
    nickname: str
    email_verified: bool

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class GoogleClientIdOut(BaseModel):
    client_id: str | None = None


class GoogleAuthIn(BaseModel):
    id_token: str = Field(min_length=20)
    nickname: str | None = Field(default=None, min_length=1, max_length=128)
    region_id: int | None = None
    city_id: int | None = None


class RefreshIn(BaseModel):
    refresh_token: str


class RefreshOut(BaseModel):
    access_token: str


class LogoutIn(BaseModel):
    refresh_token: str


class MessageOk(BaseModel):
    message: str = "ok"


class VerifyEmailIn(BaseModel):
    email: EmailStr
    code: str


class VerifyEmailOut(BaseModel):
    message: str = "verified"
    email_verified: bool = True


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ForgotPasswordOut(BaseModel):
    message: str = "code_sent"


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6)
    new_password_confirm: str = Field(min_length=6)


class ResetPasswordOut(BaseModel):
    message: str = "password_updated"


class MeOut(BaseModel):
    id: int
    email: str
    nickname: str
    region_id: int | None
    city_id: int | None
    role_id: int
    role_name: str | None = None
    email_verified: bool
    avatar: str | None = None

    model_config = {"from_attributes": True}


class ProfileOut(BaseModel):
    id: int
    nickname: str
    email: str
    region_id: int | None
    city_id: int | None
    region_name: str | None = None
    city_name: str | None = None
    avatar: str | None = None
    avatar_mime: str | None = None
    role_id: int
    email_verified: bool


class ProfileUpdateIn(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=128)
    region_id: int | None = None
    city_id: int | None = None


class ProfileUpdateOut(BaseModel):
    id: int
    nickname: str
    region_id: int | None
    city_id: int | None


class AvatarIn(BaseModel):
    avatar: str
    avatar_mime: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class PasswordChangeOut(BaseModel):
    message: str = "password_updated"


class RegionOut(BaseModel):
    id: int
    region_name: str

    model_config = {"from_attributes": True}


class RegionCreateIn(BaseModel):
    region: str


class RegionPatchIn(BaseModel):
    region: str


class CityOut(BaseModel):
    id: int
    city_name: str
    region_at: int


class DistrictOut(BaseModel):
    id: int
    district: str
    city_at: int


class CategoryOut(BaseModel):
    id: int
    category_name: str

    model_config = {"from_attributes": True}


class AnnouncementCreateIn(BaseModel):
    ann_name: str
    ann_description: str
    ann_reward: int | None = None
    ann_regions: int | None = None
    ann_region_id: int | None = None
    ann_city_id: int
    ann_district_id: int
    category_ids: list[int]
    ann_pic: str | None = None
    ann_pic_mime: str | None = None
    publish_in_found: bool = False

    def resolved_region_id(self) -> int:
        rid = self.ann_region_id if self.ann_region_id is not None else self.ann_regions
        if rid is None:
            raise ValueError("ann_region_id or ann_regions required")
        return rid


class AnnouncementCreateOut(BaseModel):
    id: int
    ann_name: str


class AnnouncementItemOut(BaseModel):
    id: int
    ann_name: str
    ann_description: str
    ann_reward: int | None
    ann_region_id: int
    ann_city_id: int
    ann_district_id: int
    user_creator_id: int
    category_ids: list[int] = []
    author_nickname: str | None = None
    region_name: str | None = None
    city_name: str | None = None
    district_name: str | None = None
    ann_pic: str | None = None
    ann_pic_mime: str | None = None
    status: str = "searching"
    publish_in_found: bool = False
    response_count: int | None = Field(
        default=None,
        description="Отклики: только для карточек автора (текущий пользователь).",
    )


class AnnouncementReplyCreateIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class AnnouncementReplyOut(BaseModel):
    id: int
    user_id: int
    nickname: str
    message: str
    created_at: datetime


class AnnouncementReplyListOut(BaseModel):
    items: list[AnnouncementReplyOut]


class AnnouncementReportCreateIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class AnnouncementReportCreateOut(BaseModel):
    id: int


class AnnouncementReportAdminItem(BaseModel):
    id: int
    announcement_id: int
    ann_name: str
    announcement_status: str
    reporter_id: int
    reporter_nickname: str
    reporter_email: str
    message: str
    created_at: datetime


class AnnouncementReportListOut(BaseModel):
    total: int
    items: list[AnnouncementReportAdminItem]


class AnnouncementListOut(BaseModel):
    total: int
    items: list[AnnouncementItemOut]


class AnnouncementDetailOut(BaseModel):
    id: int
    ann_name: str
    ann_description: str
    ann_reward: int | None


class AnnouncementModerateResult(BaseModel):
    id: int
    status: str


class AnnouncementUpdateIn(BaseModel):
    ann_name: str | None = None
    ann_description: str | None = None
    ann_reward: int | None = None


class AnnouncementUpdateOut(BaseModel):
    id: int
    ann_name: str
    ann_reward: int | None


class DeleteMessage(BaseModel):
    message: str


class RoleOut(BaseModel):
    id: int
    role_name: str

    model_config = {"from_attributes": True}


class UserAdminItem(BaseModel):
    id: int
    nickname: str
    email: str
    region_id: int | None
    city_id: int | None
    role_id: int
    is_blocked: bool = False


class UserAdminListOut(BaseModel):
    total: int
    items: list[UserAdminItem]


class UserRolePatchIn(BaseModel):
    role_id: int


class UserRolePatchOut(BaseModel):
    id: int
    role_id: int


class UserBlockPatchIn(BaseModel):
    is_blocked: bool


class UserBlockPatchOut(BaseModel):
    id: int
    is_blocked: bool


class UserPublicOut(BaseModel):
    id: int
    nickname: str
    email: str | None = None
    region_id: int | None
    city_id: int | None
    role_id: int


class UserUpdateIn(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=128)
    region_id: int | None = None
    city_id: int | None = None


class UserUpdateOut(BaseModel):
    id: int
    nickname: str
    region_id: int | None
    city_id: int | None


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    nickname: str = Field(min_length=1, max_length=128)
    region_id: int
    city_id: int


class UserCreateOut(BaseModel):
    id: int
    email: str
    nickname: str
