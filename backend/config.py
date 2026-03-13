from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 统一 API 中转站配置
    API_BASE_URL: str = "https://api.bltcy.ai/v1"
    API_KEY: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""        # anon key (public, for auth validation)
    SUPABASE_SERVICE_KEY: str = ""  # service_role key (private, bypasses RLS)
    SUPABASE_JWT_SECRET: str = ""   # JWT secret (Settings > API，用于本地验证 token)

    # 搜索服务
    TAVILY_API_KEY: str = ""       # Tavily 搜索 API key（DuckDuckGo 不稳定时的备用）

    # 模型名称映射
    MODEL_GPT: str = "gpt-4o"
    MODEL_GEMINI: str = "gemini-2.0-flash"
    MODEL_GROK: str = "grok-2"
    MODEL_DEEPSEEK: str = "deepseek-chat"

    # 可用模型列表
    @property
    def available_models(self) -> list[str]:
        return [self.MODEL_GPT, self.MODEL_GEMINI, self.MODEL_GROK, self.MODEL_DEEPSEEK]

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
