curl -X PUT localhost:8000/api/tasks/some-id \
  -d '{"id":"some-id"}' \
  -H 'Content-Type: application/json'

curl localhost:8000/api/tasks
curl localhost:8000/api/tasks/some-id

curl -X DELETE localhost:8000/api/tasks/some-id
