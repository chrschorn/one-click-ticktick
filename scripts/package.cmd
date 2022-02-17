@echo off
setlocal

del package.zip && powershell -Command "& Compress-Archive -Path %~dp0..\src\* -DestinationPath package.zip"