# Telegram AI Assistant - Advanced Memory Upgrade

Bot de Telegram con IA integrada (**GPT-5 mini** preparado y Whisper para audios). Construido en Node.js, TypeScript y Arquitectura Limpia. Destaca por poseer **Memoria a Corto y Largo Plazo** que nunca olvida preferencias y resume la charla para ahorrar tokens y costes.

## Requisitos Previos

- Tener Node.js >= 18 o Docker instalado.
- Token de tu Bot de Telegram (Se obtiene con `@BotFather` en la aplicación de Telegram).
- Clave (API Key) de tu cuenta de OpenAI.

---

## Ejecución Local Rápida

1. Descarga e ingresa a la carpeta: `cd telegram-ai-assistant`
2. Instala el proyecto:
   ```bash
   npm install
   ```
3. Renombra el archivo `.env.example` dejándolo solo como `.env` e ingresa tus datos:
   - `TELEGRAM_BOT_TOKEN="tu_token_aqui"`
   - `OPENAI_API_KEY="tu_clave_aqui"`
   - `GOG_ACCOUNT="tu_email@gmail.com"` (Opcional, para herramientas Google)
   - Y de forma opcional, si quieres que el bot solo te hable a ti, averigua tu ID de Telegram y ponlo en `TELEGRAM_ALLOWED_USER_IDS="12345678"`.
4. Inicia el bot:
   ```bash
   npm run dev
   ```

El bot iniciará en la consola y podrás hablarle. Escríbele `/start` en Telegram.

### 🔑 Integración con Google (Gmail, Calendar, Drive)
El bot utiliza la herramienta `gog` para acceder a tus servicios de Google.
1. Instala `gog` en tu sistema (si no está disponible).
2. Ejecuta la autenticación inicial:
   ```bash
   gog auth credentials /ruta/a/client_secret.json
   gog auth add tu_email@gmail.com --services gmail,calendar,drive,contacts,docs,sheets
   ```
3. El bot ahora podrá leer tus correos, agendar citas y buscar archivos cuando se lo pidas por Telegram.

---

## 💾 ¿Cómo funciona la base de datos (SQLite) y su persistencia?

Este bot utiliza **SQLite**, un motor de bases de datos que guarda toda la información directamente en un pequeño archivo en tu propio servidor (se creará en la carpeta `data/database.sqlite`). Esto garantiza privacidad y sencillez. No tienes que instalar bases complejas como MySQL o Postgres.

El bot guarda automáticamente tus preferencias, notas de voz transcritas y mensajes mediante "memoria en segundo plano" ahí mismo.

### Despliegue en un Servidor VPS con Docker o Dokploy

Si planeas mantener tu bot prendido 24/7 en un servidor (VPS) usando Dokploy o Docker Compose, la base de datos **nunca se debe borrar cada vez que reinicias el bot**. 

Por eso el archivo `docker-compose.yml` que incluimos tiene una configuración especial llamada **"Volumes" (Volúmenes)**.
Busca esto en el código:
\`\`\`yaml
volumes:
  - ./data:/usr/src/app/data
\`\`\`
**¿Qué significa esto para ti?**
Significa que la carpeta local `./data` (en tu servidor) está "conectada" permanentemente a la carpeta `/usr/src/app/data` de tu contenedor Bot.
Aunque borres, apagues, o actualices tu contenedor Bot en Dokploy, la información (tu amada `database.sqlite`) **sobrevivirá en tu Servidor físico real**.

### Pasos en Dokploy para desplegar sin problemas

1. Sube tu código a GitHub.
2. Ingresa a tu panel de Dokploy y crea una "Application".
3. Conecta el repositorio o elige el método "Docker Compose".
4. En la pestaña **Environment**, asegúrate de pegar las variables tal como las dejaste en tu `.env`.
5. Dokploy leerá automáticamente tu `docker-compose.yml`, construirá la imagen del bot, creará el volumen seguro para el disco y lo ejecutará. ¡Tu bot no perderá la memoria!
