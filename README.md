# TTS Edge para Asterisk

Sistema Text-to-Speech (TTS) para Asterisk utilizando Microsoft Edge TTS. Permite crear IVRs dinámicos con voces naturales y soporte multilingüe.

## 🚀 Características

- Integración con Microsoft Edge TTS para alta calidad de voz
- Soporte multilingüe (español, inglés, y más)
- Manejo de DTMF para IVRs interactivos
- Caché de archivos de audio para mejor rendimiento
- Fácil integración con planes de marcado existentes
- Basado en Node.js para fácil mantenimiento

## 📋 Requisitos Previos

- Asterisk 16 o superior
- Node.js 16 o superior
- npm (Node Package Manager)
- sox (Sound eXchange)
- Sistema operativo Linux (probado en Ubuntu/Debian)

## 💻 Instalación

1. **Clonar el repositorio**
(en ejemplo, se clona en '/opt/'
```bash
git clone https://github.com/giandiego/tts-edge-asterisk.git
cd tts-edge-asterisk
```

2. **Instalar dependencias del sistema**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nodejs npm sox build-essential

# CentOS/RHEL
sudo dnf install -y nodejs npm sox gcc-c++ make
```

3. **Instalar dependencias de Node.js**
```bash
npm install
```

4. **Configurar permisos**

Si se ejecuta como usuario asterisk (en caso contrario no ejecutar):
```bash
sudo chown -R asterisk:asterisk /opt/tts-edge-asterisk
```

Permisos de ejecución necesarios:
```bash
sudo chmod 755 /opt/tts-edge-asterisk
```

## ⚙️ Configuración

1. **Crear servicio systemd**

Crear el archivo `/etc/systemd/system/tts-edge-asterisk.service`:
```ini
[Unit]
Description=TTS Edge Asterisk Service
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/tts-edge-asterisk/index.js
WorkingDirectory=/opt/tts-edge-asterisk
;Aquí el usuario que ejecuta asterisk, si es root, dejar comentado.
;User=asterisk
;Group=asterisk
Restart=always

[Install]
WantedBy=multi-user.target
```

2. **Habilitar e iniciar el servicio**
```bash
sudo systemctl enable tts-edge-asterisk
sudo systemctl start tts-edge-asterisk
```

3. **Configurar Asterisk**

Agregar a `/etc/asterisk/extensions.conf`:
```ini
[from-internal]
exten => 12345,1,Answer()
    same => n,Goto(my-ivr,s,1)
    same => n,Hangup()

[my-ivr]
; Inicio del IVR
exten => s,1,Answer()
    same => n,Set(TIMEOUT(digit)=5)
    same => n,AGI(agi://localhost:4573,"Bienvenido a nuestro menú interactivo","es")
    same => n(menu),AGI(agi://localhost:4573,"Para español presione 1, for English press 2","es",any)
    same => n,WaitExten()

; Resto del plan de marcado...
```

## 📚 Uso

### Sintaxis Básica
```ini
AGI(agi://localhost:4573,"texto a reproducir","idioma"[,"any"])
```

- **texto**: Mensaje que se convertirá a voz
- **idioma**: Código del idioma (es, en, etc.)
- **any**: Opcional, para esperar entrada DTMF

### Ejemplos

1. **Mensaje simple**
```ini
exten => 1000,1,AGI(agi://localhost:4573,"Bienvenido a nuestra empresa","es")
```

2. **Esperar entrada del usuario**
```ini
exten => 2000,1,AGI(agi://localhost:4573,"Por favor marque una opción","es","any")
```

3. **Mensaje en inglés**
```ini
exten => 3000,1,AGI(agi://localhost:4573,"Welcome to our company","en")
```

## 🔍 Monitoreo y Logs

### Ver logs del servicio
```bash
journalctl -u tts-edge-asterisk -f
```

### Verificar estado
```bash
systemctl status tts-edge-asterisk
```

## 🛠️ Solución de Problemas

### El servicio no inicia
1. Verificar permisos:
```bash
ls -l /opt/tts-edge-asterisk
```

2. Verificar logs:
```bash
journalctl -u tts-edge-asterisk -n 50
```

### No se escucha el audio
1. Verificar que sox está instalado:
```bash
which sox
```

2. Comprobar permisos de directorios temporales:
```bash
ls -l /opt/tts-edge-asterisk
```

## 📝 Voces Disponibles

| Idioma    | Código | Voz                |
|-----------|--------|-------------------|
| Español   | es     | es-PE-CamilaNeural|
| Inglés    | en     | en-US-JennyNeural |
| Francés   | fr     | fr-FR-DeniseNeural|
| Portugués | pt     | pt-BR-FranciscaNeural|
| Alemán    | de     | de-DE-KatjaNeural |

## 🤝 Contribuir

1. Fork del repositorio
2. Crear una rama para tu función
3. Commit de tus cambios
4. Push a la rama
5. Crear un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia ISC - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Autores

* **Diego** - *Trabajo inicial* - [giandiego](https://github.com/giandiego)

## 🎁 Agradecimientos

* Microsoft Edge TTS por proporcionar el servicio de voz
* La comunidad de Asterisk por su continuo soporte
* A todos los contribuidores que ayudan a mejorar este proyecto
