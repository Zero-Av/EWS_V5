2026-06-25 17:05:32.208 | INFO     | main:log_requests:82 - OPTIONS /employees/EMP2002/classify-manual → 200 (0.001s)
INFO:     127.0.0.1:60522 - "OPTIONS /employees/EMP2002/classify-manual HTTP/1.1" 200 OK
INFO:     127.0.0.1:60522 - "POST /employees/EMP2002/classify-manual HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\uvicorn\protocols\http\httptools_impl.py", line 421, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\uvicorn\middleware\proxy_headers.py", line 62, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\applications.py", line 1163, in __call__
    await super().__call__(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\applications.py", line 90, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\errors.py", line 186, in __call__
    raise exc
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\errors.py", line 164, in __call__
    await self.app(scope, receive, _send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\base.py", line 193, in __call__
    response = await self.dispatch_func(request, call_next)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\main.py", line 81, in log_requests
    response = await call_next(request)
               ^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\base.py", line 168, in call_next
    raise app_exc from app_exc.__cause__ or app_exc.__context__
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\base.py", line 144, in coro
    await self.app(scope, receive_or_disconnect, send_no_error)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\cors.py", line 96, in __call__
    await self.simple_response(scope, receive, send, request_headers=headers)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\cors.py", line 154, in simple_response
    await self.app(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\middleware\exceptions.py", line 63, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\middleware\asyncexitstack.py", line 18, in __call__
    await self.app(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\routing.py", line 660, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 2531, in app
    await route.handle(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 1700, in handle
    await self.original_router.handle(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 2586, in handle
    await included_router._handle_selected(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 1720, in _handle_selected
    await original_route.handle(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 1239, in handle
    await app(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 150, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 136, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 690, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "C:\Users\arnav.verma\Desktop\V_8\ews_v5\backend\venv\Lib\site-packages\fastapi\routing.py", line 344, in run_endpoint_function
2026-06-25 17:05:35.519 | INFO     | main:log_requests:82 - GET /classifications → 200 (0.178s)
INFO:     127.0.0.1:49964 - "GET /classifications HTTP/1.1" 200 OK
