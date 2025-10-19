import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure API key
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

print("Available models:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(f"- {m.name}")

# Test a simple model
try:
    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content("Hello")
    print(f"\ngemini-1.5-pro works: {response.text}")
except Exception as e:
    print(f"gemini-1.5-pro failed: {e}")

try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content("Hello")
    print(f"gemini-1.5-flash works: {response.text}")
except Exception as e:
    print(f"gemini-1.5-flash failed: {e}")

try:
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Hello")
    print(f"gemini-pro works: {response.text}")
except Exception as e:
    print(f"gemini-pro failed: {e}")
