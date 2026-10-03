# Gemini GenAI Integration Guide

ExamiQ uses the official `@google/generative-ai` SDK on the backend server for all AI workflows.

## Features Powered by Gemini
1. **AI Study Lab**: Generates Short Notes, One-Liners, Key Concepts, Important Exam Points, Common Confusions, and MCQs from uploaded documents.
2. **AI Explanation ("WHY?")**: Explains correct answer rationale, why user selected option was wrong, and exam tips.
3. **Practice Similar Generator**: Dynamically generates MCQs around missed concepts.
4. **AI Study Assistant**: Interactive tutor responding to student queries.

## API Key Configuration
1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
2. Add the key to `server/.env`:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
3. Restart the server.

*Note: If no API key is provided, ExamiQ gracefully switches to intelligent rule-based study generators without crashing.*
