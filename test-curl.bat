@echo off
echo Testing Autodesk API JSON Responses
echo.

echo 1. Testing auth token endpoint:
curl -X GET http://localhost:3002/api/auth/token
echo.
echo.

echo 2. Testing analyze endpoint:
curl -X POST http://localhost:3002/api/analyze -H "Content-Type: application/json" -d "{\"urn\":\"test-urn\"}"
echo.
echo.

echo 3. Testing design details endpoint:
curl -X POST http://localhost:3002/api/design/details -H "Content-Type: application/json" -d "{\"urn\":\"test-urn\"}"
echo.

pause