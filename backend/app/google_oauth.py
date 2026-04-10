import httpx
from fastapi import HTTPException, status

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


async def verify_google_id_token(id_token: str, expected_client_id: str) -> dict:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                GOOGLE_TOKENINFO_URL,
                params={"id_token": id_token},
                timeout=15.0,
            )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google verification unavailable",
        ) from e

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential")

    data = resp.json()
    if data.get("aud") != expected_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential")

    verified = data.get("email_verified")
    if verified not in (True, "true"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email is not verified",
        )

    email = (data.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google email missing")

    return data
