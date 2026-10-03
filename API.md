# API Endpoints Reference

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## User & Dashboard
- `GET /api/users/dashboard`
- `PUT /api/users/target-exams`
- `GET /api/users/leaderboard`

## Questions & Practice
- `GET /api/questions`
- `POST /api/questions`
- `POST /api/tests/create`
- `POST /api/tests/submit`

## AI Study Lab & Gemini
- `POST /api/ai/process-material`
- `GET /api/ai/study-packs`
- `POST /api/ai/explain`
- `POST /api/ai/similar-questions`
- `POST /api/ai/assistant-chat`

## Revision & Spaced Repetition
- `GET /api/revision/notebook`
- `GET /api/revision/due-items`
- `GET /api/revision/weak-topics`

## Realtime Multiplayer Battle (WebSockets)
- Event: `create_room`
- Event: `join_room`
- Event: `start_battle`
- Event: `submit_answer`
- Event: `request_rematch`
