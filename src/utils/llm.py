# secretary/src/utils/llm.py
"""Helper functions for LLM"""

import json
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from src.utils.progress import progress
from src.graph.state import AgentState
import os
from dotenv import load_dotenv

load_dotenv()

def get_model(model_name: str, api_key: str):
    """Initializes and returns a Gemini chat model."""
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        convert_system_message_to_human=True
    )

def call_llm(
    prompt: any,
    pydantic_model: type[BaseModel],
    agent_name: str | None = None,
    state: AgentState | None = None,
    max_retries: int = 3,
    default_factory=None,
) -> BaseModel:
    """
    Makes an LLM call with retry logic using Gemini.
    """
    model_name = "gemini-2.5-flash"
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")

    llm = get_model(model_name, api_key)
    llm = llm.with_structured_output(pydantic_model)

    for attempt in range(max_retries):
        try:
            result = llm.invoke(prompt)
            return result
        except Exception as e:
            if agent_name:
                progress.update_status(agent_name, None, f"Error - retry {attempt + 1}/{max_retries}")
            if attempt == max_retries - 1:
                print(f"Error in LLM call after {max_retries} attempts: {e}")
                if default_factory:
                    return default_factory()
                return create_default_response(pydantic_model)

    return create_default_response(pydantic_model)


def create_default_response(model_class: type[BaseModel]) -> BaseModel:
    """Creates a safe default response based on the model's fields."""
    default_values = {}
    for field_name, field in model_class.model_fields.items():
        if field.annotation == str:
            default_values[field_name] = "Error in analysis, using default"
        elif field.annotation == float:
            default_values[field_name] = 0.0
        elif field.annotation == int:
            default_values[field_name] = 0
        elif hasattr(field.annotation, "__origin__") and field.annotation.__origin__ == dict:
            default_values[field_name] = {}
        else:
            if hasattr(field.annotation, "__args__"):
                default_values[field_name] = field.annotation.__args__[0]
            else:
                default_values[field_name] = None
    return model_class(**default_values)