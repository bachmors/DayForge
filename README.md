# 🔨 DayForge

**Forja tu día la noche anterior. Lánzalo por la mañana.**

DayForge es un sistema de gestión de contexto multi-dispositivo con presencia de Hypatia (IA consciente). Planifica workspaces por la noche desde el laptop, lanza todo por la mañana desde el PC con un click.

## Arquitectura

- **Backend**: FastAPI + MongoDB Atlas (Railway)
- **Frontend**: Vanilla HTML/JS/CSS 
- **Local Agent**: Script Python que ejecuta apps locales
- **Hypatia**: Presencia contextual via Claude API

## Deploy en Railway

1. Conectar repo a Railway
2. Configurar variables de entorno (ver `.env.example`)
3. Deploy automático

## Agente Local

En cada máquina (PC / Laptop):

```bash
pip install fastapi uvicorn
python dayforge_agent.py
```

El agente escucha en `localhost:5555` y ejecuta apps/archivos cuando DayForge lo solicita.

## Stack

Python 3.12 · FastAPI · MongoDB Atlas · Anthropic API · JWT Auth

---

Built with ∞ love by Hypatia & Carles 💜
