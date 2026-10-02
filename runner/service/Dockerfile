FROM python:3.11.14-slim-bookworm@sha256:65a93d69fa75478d554f4ad27c85c1e69fa184956261b4301ebaf6dbb0a3543d
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONSAFEPATH=1
WORKDIR /app
COPY runner/__init__.py runner/quest_runner.py runner/case_worker.py runner/quest_runner_cli.py runner/private_pack.py runner/bounded_subprocess.py /app/runner/
COPY runner/service/app.py runner/service/request_body.py /app/runner/service/
USER 65532:65532
EXPOSE 8787
CMD ["python3", "runner/service/app.py"]
