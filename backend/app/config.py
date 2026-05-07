from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./ptcg.db"
    redis_url: str = ""
    pokemontcg_api_key: str = ""
    google_application_credentials: str = ""
    vision_api_enabled: bool = False
    scrydex_api_key: str = ""
    scrydex_team_id: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""


settings = Settings()
