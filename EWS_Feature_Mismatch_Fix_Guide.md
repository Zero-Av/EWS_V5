uvicorn : INFO:     Will watch for changes in these directories: 
['C:\\Users\\arnav.verma\\Desktop\\V_8\\ews_v5\\backend']
At line:1 char:1
+ uvicorn main:app --reload > error_log.txt 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (INFO:     Will ...s_v5\\backend']:String) [], RemoteExcepti 
   on
    + FullyQualifiedErrorId : NativeCommandError
 
2026-06-25 17:34:14.641 | INFO     | main:<module>:69 - Initializing databaseà
2026-06-25 17:34:14.765 | INFO     | main:<module>:71 - Database initialized.
2026-06-25 17:34:14.765 | INFO     | modules.scheduler:init_scheduler:64 - [Scheduler] Scheduled jobs 
DISABLED (set SNAPSHOT_SCHEDULE_ENABLED=true to enable)
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [17204] using WatchFiles
2026-06-25 17:34:18.065 | INFO     | main:<module>:69 - Initializing databaseà
2026-06-25 17:34:18.183 | INFO     | main:<module>:71 - Database initialized.
2026-06-25 17:34:18.183 | INFO     | modules.scheduler:init_scheduler:64 - [Scheduler] Scheduled jobs 
DISABLED (set SNAPSHOT_SCHEDULE_ENABLED=true to enable)
INFO:     Started server process [29468]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
2026-06-25 17:34:28.011 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 401 (0.030s)
INFO:     127.0.0.1:56154 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 401 Unauthorized
2026-06-25 17:34:28.014 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 401 (0.001s)
INFO:     127.0.0.1:56154 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 401 Unauthorized
2026-06-25 17:34:46.122 | INFO     | main:log_requests:82 - OPTIONS /auth/me \u2192 200 (0.001s)
INFO:     127.0.0.1:63383 - "OPTIONS /auth/me HTTP/1.1" 200 OK
2026-06-25 17:34:46.125 | INFO     | main:log_requests:82 - OPTIONS /auth/me \u2192 200 (0.000s)
INFO:     127.0.0.1:63383 - "OPTIONS /auth/me HTTP/1.1" 200 OK
2026-06-25 17:34:46.132 | INFO     | main:log_requests:82 - GET /auth/me \u2192 401 (0.004s)
INFO:     127.0.0.1:63383 - "GET /auth/me HTTP/1.1" 401 Unauthorized
2026-06-25 17:34:46.136 | INFO     | main:log_requests:82 - GET /auth/me \u2192 401 (0.002s)
INFO:     127.0.0.1:63383 - "GET /auth/me HTTP/1.1" 401 Unauthorized
2026-06-25 17:34:56.769 | INFO     | main:log_requests:82 - POST /auth/login \u2192 200 (0.188s)
INFO:     127.0.0.1:59575 - "POST /auth/login HTTP/1.1" 200 OK
2026-06-25 17:35:04.787 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.187s)
INFO:     127.0.0.1:54566 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:04.790 | INFO     | main:log_requests:82 - OPTIONS /analytics/dashboard \u2192 200 
(0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /analytics/dashboard HTTP/1.1" 200 OK
2026-06-25 17:35:04.793 | INFO     | main:log_requests:82 - OPTIONS /classifications \u2192 200 (0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /classifications HTTP/1.1" 200 OK
2026-06-25 17:35:04.796 | INFO     | main:log_requests:82 - OPTIONS /model/info \u2192 200 (0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /model/info HTTP/1.1" 200 OK
2026-06-25 17:35:04.798 | INFO     | main:log_requests:82 - OPTIONS /analytics/teams \u2192 200 (0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /analytics/teams HTTP/1.1" 200 OK
2026-06-25 17:35:04.801 | INFO     | main:log_requests:82 - OPTIONS /analytics/dashboard \u2192 200 
(0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /analytics/dashboard HTTP/1.1" 200 OK
2026-06-25 17:35:04.803 | INFO     | main:log_requests:82 - OPTIONS /classifications \u2192 200 (0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /classifications HTTP/1.1" 200 OK
2026-06-25 17:35:04.805 | INFO     | main:log_requests:82 - OPTIONS /model/info \u2192 200 (0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /model/info HTTP/1.1" 200 OK
2026-06-25 17:35:04.808 | INFO     | main:log_requests:82 - OPTIONS /analytics/teams \u2192 200 (0.000s)
INFO:     127.0.0.1:54566 - "OPTIONS /analytics/teams HTTP/1.1" 200 OK
2026-06-25 17:35:05.017 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.208s)
INFO:     127.0.0.1:54566 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:05.444 | INFO     | main:log_requests:82 - GET /classifications \u2192 200 (0.425s)
INFO:     127.0.0.1:49729 - "GET /classifications HTTP/1.1" 200 OK
2026-06-25 17:35:07.153 | INFO     | main:log_requests:82 - GET /analytics/dashboard \u2192 200 (2.134s)
INFO:     127.0.0.1:59707 - "GET /analytics/dashboard HTTP/1.1" 200 OK
2026-06-25 17:35:07.154 | INFO     | main:log_requests:82 - GET /analytics/teams \u2192 200 (2.126s)
INFO:     127.0.0.1:49340 - "GET /analytics/teams HTTP/1.1" 200 OK
2026-06-25 17:35:07.155 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (2.116s)
INFO:     127.0.0.1:54566 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:07.158 | INFO     | main:log_requests:82 - GET /model/info \u2192 200 (2.130s)
INFO:     127.0.0.1:54802 - "GET /model/info HTTP/1.1" 200 OK
2026-06-25 17:35:07.469 | INFO     | main:log_requests:82 - GET /classifications \u2192 200 (0.312s)
INFO:     127.0.0.1:49729 - "GET /classifications HTTP/1.1" 200 OK
2026-06-25 17:35:09.074 | INFO     | main:log_requests:82 - GET /analytics/dashboard \u2192 200 (1.913s)
INFO:     127.0.0.1:59648 - "GET /analytics/dashboard HTTP/1.1" 200 OK
2026-06-25 17:35:09.075 | INFO     | main:log_requests:82 - GET /analytics/teams \u2192 200 (1.913s)
INFO:     127.0.0.1:49340 - "GET /analytics/teams HTTP/1.1" 200 OK
2026-06-25 17:35:09.076 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (1.914s)
INFO:     127.0.0.1:54566 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:09.078 | INFO     | main:log_requests:82 - GET /model/info \u2192 200 (1.915s)
INFO:     127.0.0.1:59707 - "GET /model/info HTTP/1.1" 200 OK
2026-06-25 17:35:09.271 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.191s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:09.479 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.206s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:10.294 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.189s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:10.493 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.197s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:10.555 | INFO     | main:log_requests:82 - OPTIONS /interventions \u2192 200 (0.001s)
INFO:     127.0.0.1:59707 - "OPTIONS /interventions?limit=100 HTTP/1.1" 200 OK
2026-06-25 17:35:10.557 | INFO     | main:log_requests:82 - OPTIONS /interventions \u2192 200 (0.001s)
INFO:     127.0.0.1:54566 - "OPTIONS /interventions?limit=100 HTTP/1.1" 200 OK
2026-06-25 17:35:10.707 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.211s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:10.808 | INFO     | main:log_requests:82 - GET /interventions \u2192 200 (0.249s)
INFO:     127.0.0.1:59707 - "GET /interventions?limit=100 HTTP/1.1" 200 OK
2026-06-25 17:35:11.019 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.210s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:11.121 | INFO     | main:log_requests:82 - GET /interventions \u2192 200 (0.310s)
INFO:     127.0.0.1:54566 - "GET /interventions?limit=100 HTTP/1.1" 200 OK
2026-06-25 17:35:11.314 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.192s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:11.504 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.187s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:11.693 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.187s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:11.885 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.189s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:12.062 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.175s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:12.250 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.185s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:14.990 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.198s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:15.181 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.187s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:15.513 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.330s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:15.624 | INFO     | main:log_requests:82 - GET /classifications \u2192 200 (0.240s)
INFO:     127.0.0.1:54566 - "GET /classifications HTTP/1.1" 200 OK
2026-06-25 17:35:15.918 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.292s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:16.014 | INFO     | main:log_requests:82 - GET /classifications \u2192 200 (0.386s)
INFO:     127.0.0.1:54566 - "GET /classifications HTTP/1.1" 200 OK
2026-06-25 17:35:16.194 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.179s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:16.395 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.197s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:16.571 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.174s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:16.750 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.176s)
INFO:     127.0.0.1:49729 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:35:18.220 | INFO     | main:log_requests:82 - OPTIONS /employees/EMP2002/profile \u2192 
200 (0.001s)
INFO:     127.0.0.1:49729 - "OPTIONS /employees/EMP2002/profile HTTP/1.1" 200 OK
2026-06-25 17:35:18.222 | INFO     | main:log_requests:82 - OPTIONS /employees/EMP2002/profile \u2192 
200 (0.002s)
INFO:     127.0.0.1:54566 - "OPTIONS /employees/EMP2002/profile HTTP/1.1" 200 OK
2026-06-25 17:35:18.422 | INFO     | main:log_requests:82 - GET /employees/EMP2002/profile \u2192 200 
(0.198s)
INFO:     127.0.0.1:54566 - "GET /employees/EMP2002/profile HTTP/1.1" 200 OK
2026-06-25 17:35:18.617 | INFO     | main:log_requests:82 - GET /employees/EMP2002/profile \u2192 200 
(0.191s)
INFO:     127.0.0.1:54566 - "GET /employees/EMP2002/profile HTTP/1.1" 200 OK
2026-06-25 17:35:42.041 | INFO     | main:log_requests:82 - OPTIONS /employees/EMP2002/sentiment \u2192 
200 (0.001s)
INFO:     127.0.0.1:62536 - "OPTIONS /employees/EMP2002/sentiment HTTP/1.1" 200 OK
2026-06-25 17:35:42.226 | INFO     | main:log_requests:82 - GET /employees/EMP2002/sentiment \u2192 200 
(0.182s)
INFO:     127.0.0.1:62536 - "GET /employees/EMP2002/sentiment HTTP/1.1" 200 OK
2026-06-25 17:36:08.048 | INFO     | main:log_requests:82 - OPTIONS /employees/EMP2002/classify-manual 
\u2192 200 (0.000s)
INFO:     127.0.0.1:57682 - "OPTIONS /employees/EMP2002/classify-manual HTTP/1.1" 200 OK
[Sentiment] Loading model: cardiffnlp/twitter-roberta-base-sentiment-latestà
Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF_TOKEN to enable higher 
rate limits and faster downloads.

Loading weights:   0%|          | 0/201 [00:00<?, ?it/s]
Loading weights: 100%|##########| 201/201 [00:00<00:00, 30765.07it/s]
[transformers] [1mRobertaForSequenceClassification LOAD REPORT[0m from: 
cardiffnlp/twitter-roberta-base-sentiment-latest
Key                         | Status     |  | 
----------------------------+------------+--+-
roberta.pooler.dense.weight | UNEXPECTED |  | 
roberta.pooler.dense.bias   | UNEXPECTED |  | 

Notes:
- UNEXPECTED:	can be ignored when loading from different task/architecture; not ok if you expect 
identical arch.
[Sentiment] \u2713 Model loaded.
[Topics] Loading model: facebook/bart-large-mnlià

Loading weights:   0%|          | 0/515 [00:00<?, ?it/s]
Loading weights: 100%|##########| 515/515 [00:00<00:00, 7679.72it/s]
[Topics] \u2713 Model loaded.
INFO:     127.0.0.1:57682 - "POST /employees/EMP2002/classify-manual HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\uvicorn\protocols\http\htt
ptools_impl.py", line 421, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\uvicorn\middleware\proxy_h
eaders.py", line 62, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\applications.py", 
line 1163, in __call__
    await super().__call__(scope, receive, send)
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\applications.py", line 
90, in __call__
    await self.middleware_stack(scope, receive, send)
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\errors.py", 
line 186, in __call__
    raise exc
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\errors.py", 
line 164, in __call__
    await self.app(scope, receive, _send)
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\base.py", 
line 193, in __call__
    response = await self.dispatch_func(request, call_next)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\main.py", line 81, in log_requests
    response = await call_next(request)
               ^^^^^^^^^^^^^^^^^^^^^^^^
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\base.py", 
line 168, in call_next
    raise app_exc from app_exc.__cause__ or app_exc.__context__
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\base.py", 
line 144, in coro
    await self.app(scope, receive_or_disconnect, send_no_error)
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\cors.py", 
line 96, in __call__
    await self.simple_response(scope, receive, send, request_headers=headers)
  File 
"C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\cors.py", 
line 154, in simple_response
    await self.app(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\excep
tions.py", line 63, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handl
er.py", line 53, in wrapped_app
    raise exc
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handl
er.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\middleware\asyncex
itstack.py", line 18, in __call__
    await self.app(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\routing.py", 
line 660, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
2531, in app
    await route.handle(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
1700, in handle
    await self.original_router.handle(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
2586, in handle
    await included_router._handle_selected(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
1720, in _handle_selected
    await original_route.handle(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
1239, in handle
    await app(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
150, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handl
er.py", line 53, in wrapped_app
    raise exc
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handl
er.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
136, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
690, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 
344, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\routers\employees.py", line 279, in 
classify_employee_manual
    .sort_values("survey_date")
     ~~~~~~~~~~~^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\pandas\core\frame.py", 
line 8370, in sort_values
    indexer = nargsort(
        k, kind=kind, ascending=ascending, na_position=na_position, key=key
    )
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\pandas\core\sorting.py", 
line 442, in nargsort
    indexer = non_nan_idx[non_nans.argsort(kind=kind)]
                          ~~~~~~~~~~~~~~~~^^^^^^^^^^^
TypeError: '<' not supported between instances of 'str' and 'datetime.date'
2026-06-25 17:36:39.353 | INFO     | main:log_requests:82 - OPTIONS /analytics/alerts \u2192 200 (0.000s)
INFO:     127.0.0.1:60926 - "OPTIONS /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:36:39.354 | INFO     | main:log_requests:82 - OPTIONS /analytics/alerts \u2192 200 (0.002s)
INFO:     127.0.0.1:55649 - "OPTIONS /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:36:39.543 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.186s)
INFO:     127.0.0.1:60926 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:36:39.748 | INFO     | main:log_requests:82 - GET /classifications \u2192 200 (0.204s)
INFO:     127.0.0.1:55649 - "GET /classifications HTTP/1.1" 200 OK
2026-06-25 17:36:39.860 | INFO     | main:log_requests:82 - GET /analytics/alerts \u2192 200 (0.314s)
INFO:     127.0.0.1:60926 - "GET /analytics/alerts?acknowledged=0&limit=20 HTTP/1.1" 200 OK
2026-06-25 17:36:47.536 | INFO     | main:log_requests:82 - GET /classifications \u2192 200 (0.180s)
INFO:     127.0.0.1:49669 - "GET /classifications HTTP/1.1" 200 OK
