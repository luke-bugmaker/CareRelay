@echo off
setlocal
title CareRelay launcher

rem ---------------------------------------------------------------
rem  CareRelay launcher
rem
rem  1) Start   - opens the backend and the frontend in their own
rem               windows, waits until the API answers, then opens
rem               the browser.
rem  2) Reset   - stops the backend and wipes the demo data: the
rem               care events, the schedule/tasks, the uploaded
rem               photos, and the chat bubbles kept in the browser.
rem
rem  Double-click this file. Everything below is relative to it.
rem ---------------------------------------------------------------

cd /d "%~dp0"
set "ROOT=%~dp0"
set "VENVPY=%ROOT%backend\.venv\Scripts\python.exe"
set "HEALTHFILE=%TEMP%\carerelay_health.txt"
set "CLIPFILE=%TEMP%\carerelay_clear.js"

:menu
cls
echo.
echo   ==========================================
echo      C a r e R e l a y
echo   ==========================================
echo.
echo     [1]  Start CareRelay      (backend + frontend)
echo     [2]  Reset the demo data  (chat history + tasks + photos)
echo     [0]  Exit
echo.
set "CHOICE="
set /p "CHOICE=  Pick 1, 2 or 0, then press Enter: "
if "%CHOICE%"=="1" goto start_app
if "%CHOICE%"=="2" goto reset_data
if "%CHOICE%"=="0" goto end
echo.
echo   "%CHOICE%" is not one of the options.
pause
goto menu


rem ===============================================================
rem  1. START
rem ===============================================================
:start_app
cls
echo.
echo   Starting CareRelay...
echo.

if not exist "%ROOT%backend\app\main.py" goto err_wrong_folder

rem --- Python environment -----------------------------------------
if exist "%VENVPY%" goto venv_ready
echo   First run: creating the Python environment. This takes a minute.
where python >nul 2>nul
if errorlevel 1 goto err_no_python
pushd "%ROOT%backend"
python -m venv .venv
if errorlevel 1 goto err_venv_failed
"%VENVPY%" -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 goto err_pip_failed
popd
echo   Python environment ready.
echo.
:venv_ready

rem --- Node packages ----------------------------------------------
if exist "%ROOT%frontend\node_modules" goto node_ready
echo   First run: installing the frontend packages. About 15 seconds.
where npm >nul 2>nul
if errorlevel 1 goto err_no_npm
pushd "%ROOT%frontend"
call npm install
if errorlevel 1 goto err_npm_failed
popd
echo   Frontend packages ready.
echo.
:node_ready

rem --- .env -------------------------------------------------------
if exist "%ROOT%.env" goto env_ready
echo   No .env found - copying .env.example.
echo   The app will start, but with no API key it uses the offline
echo   keyword parser instead of real AI. See HOW_TO_RUN.txt part 0.
copy /y "%ROOT%.env.example" "%ROOT%.env" >nul
echo.
:env_ready

rem --- Launch both halves -----------------------------------------
echo   Opening the backend window...
start "CareRelay backend" cmd /k "cd /d "%ROOT%backend" && "%VENVPY%" -m uvicorn app.main:app --reload"

echo   Opening the frontend window...
start "CareRelay frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo   Waiting for the backend to answer on port 8000...

set /a TRIES=0
:wait_loop
set /a TRIES+=1
curl.exe -s -m 2 http://127.0.0.1:8000/health > "%HEALTHFILE%" 2>nul
findstr /c:"\"status\":\"ok\"" "%HEALTHFILE%" >nul 2>nul
if not errorlevel 1 goto backend_up
if %TRIES% geq 30 goto backend_slow
call :sleep 2
goto wait_loop

:backend_up
echo   Backend is up.
findstr /c:"\"ai_configured\":true" "%HEALTHFILE%" >nul 2>nul
if errorlevel 1 goto ai_off
echo   Real AI is connected.
goto open_browser

:ai_off
echo.
echo   WARNING: ai_configured is false.
echo   The app will still work, but on the offline keyword parser -
echo   it looks the same in the UI. Put AI_API_KEY, AI_BASE_URL and
echo   AI_MODEL in CareRelay\.env, then start again.
echo.
goto open_browser

:backend_slow
echo.
echo   The backend has not answered in 60 seconds.
echo   Read the red text in the "CareRelay backend" window.
echo   Opening the page anyway - it will show "Demo data".
echo.

:open_browser
echo   Opening http://localhost:5173
call :sleep 3
start "" http://localhost:5173
echo.
echo   Both windows stay open. Close them, or press Ctrl+C inside
echo   them, to stop CareRelay.
echo.
pause
goto menu


rem ===============================================================
rem  2. RESET
rem ===============================================================
:reset_data
cls
echo.
echo   RESET THE DEMO DATA
echo   -------------------
echo.
echo   This deletes, permanently:
echo.
echo     - every care event on the timeline
echo     - every task / appointment on the schedule
echo     - every uploaded photo
echo     - the chat bubbles saved in your browser
echo.
echo   Amy and Ben and the two seeded demo entries come back
echo   automatically the next time the backend starts.
echo.
set "CONFIRM="
set /p "CONFIRM=  Type YES to erase it, or press Enter to go back: "
if /i not "%CONFIRM%"=="YES" goto menu

echo.
echo   Stopping the backend so the database file is not locked...
rem /t because the window owns a uvicorn reloader that owns the real
rem server process - kill only the middle one and it comes back.
taskkill /f /t /fi "WINDOWTITLE eq CareRelay backend*" >nul 2>nul
taskkill /f /t /fi "WINDOWTITLE eq Administrator:  CareRelay backend*" >nul 2>nul
rem The window title only exists if this script opened the backend.
rem Otherwise fall back to whatever python is holding port 8000 -
rem the image-name check keeps this from killing an unrelated app.
rem Twice: the reloader can hand the port to a fresh child once.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:"TCP.*:8000 .*LISTENING"') do call :kill_python %%P
call :sleep 1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:"TCP.*:8000 .*LISTENING"') do call :kill_python %%P
call :sleep 2

if not exist "%ROOT%backend\care_relay.db" goto db_gone
del /q "%ROOT%backend\care_relay.db" >nul 2>nul
if exist "%ROOT%backend\care_relay.db" goto err_db_locked
echo   Database deleted.
goto db_done
:db_gone
echo   No database to delete - already clean.
:db_done

del /q "%ROOT%backend\uploads\*.png" >nul 2>nul
del /q "%ROOT%backend\uploads\*.jpg" >nul 2>nul
del /q "%ROOT%backend\uploads\*.jpeg" >nul 2>nul
del /q "%ROOT%backend\uploads\*.gif" >nul 2>nul
del /q "%ROOT%backend\uploads\*.webp" >nul 2>nul
del /q "%ROOT%backend\uploads\*.wav" >nul 2>nul
del /q "%ROOT%backend\uploads\*.webm" >nul 2>nul
echo   Uploaded photos deleted.

rem --- the browser half, which no batch file can reach directly ----
> "%CLIPFILE%" echo localStorage.removeItem('careRelay.threads'); localStorage.removeItem('careRelay.caregiverId'); location.reload();
clip < "%CLIPFILE%" 2>nul
del /q "%CLIPFILE%" >nul 2>nul

echo.
echo   ---------------------------------------------------------
echo   One step left, and it has to happen inside the browser.
echo   The chat bubbles live in the browser's own storage, which
echo   nothing outside the browser can touch.
echo.
echo   The command is already copied to your clipboard:
echo.
echo     1. Open the CareRelay page
echo     2. Press F12, click the "Console" tab
echo     3. Press Ctrl+V, then Enter
echo.
echo   Shortcut if you would rather not: open the page in a
echo   private / incognito window. It keeps nothing.
echo   ---------------------------------------------------------
echo.
set "AGAIN="
set /p "AGAIN=  Start CareRelay again now? (Y/N): "
if /i "%AGAIN%"=="Y" goto start_app
goto menu


rem ===============================================================
rem  Helper: wait N seconds. `timeout` refuses to run when this
rem  script's input is redirected, so ping does the waiting.
rem ===============================================================
:sleep
set /a "SLEEPN=%~1+1"
ping -n %SLEEPN% 127.0.0.1 >nul 2>nul
exit /b 0


rem ===============================================================
rem  Helper: kill PID %1, but only if it really is a python process.
rem ===============================================================
:kill_python
tasklist /fi "PID eq %~1" /nh 2>nul | findstr /i /c:"python.exe" >nul 2>nul
if errorlevel 1 exit /b 0
taskkill /f /t /pid %~1 >nul 2>nul
exit /b 0


rem ===============================================================
rem  Errors
rem ===============================================================
:err_wrong_folder
echo.
echo   ERROR: backend\app\main.py is missing.
echo   This file has to sit in the CareRelay folder, next to
echo   README.md and the backend and frontend folders.
echo.
pause
goto menu

:err_no_python
echo.
echo   ERROR: Python is not on PATH.
echo   Install Python 3.11 or newer from python.org, tick
echo   "Add python.exe to PATH" during setup, then open a NEW
echo   window and run this file again.
echo.
pause
goto menu

:err_venv_failed
popd
echo.
echo   ERROR: could not create backend\.venv. Read the message above.
echo.
pause
goto menu

:err_pip_failed
popd
echo.
echo   ERROR: pip install failed. Usually no internet, or a proxy.
echo   Read the message above.
echo.
pause
goto menu

:err_no_npm
echo.
echo   ERROR: npm is not on PATH.
echo   Install Node.js 20 or newer from nodejs.org, then open a NEW
echo   window and run this file again.
echo.
pause
goto menu

:err_npm_failed
popd
echo.
echo   ERROR: npm install failed. Read the message above.
echo.
pause
goto menu

:err_db_locked
echo.
echo   ERROR: could not delete backend\care_relay.db - something
echo   still has it open. Close every "CareRelay backend" window
echo   by hand, then run the reset again.
echo.
pause
goto menu

:end
endlocal
