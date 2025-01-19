import { AGIServer } from 'voxo-agi';
import { MsEdgeTTS, OUTPUT_FORMAT } from "ly-ms-edge-tts";
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { transcode } from 'sox';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de directorio temporal
const TMP_DIR = join(os.tmpdir(), 'tts-edge-asterisk');

// Configuración de voces por idioma
const VOICE_CONFIG = {
    'es': 'es-PE-CamilaNeural',
    'en': 'en-US-JennyNeural',
    'fr': 'fr-FR-DeniseNeural',
    'pt': 'pt-BR-FranciscaNeural',
    'de': 'de-DE-KatjaNeural'
};

/**
 * Clase para manejar la generación y gestión de archivos TTS.
 * Se encarga de:
 *  - Crear el directorio temporal si no existe.
 *  - Limpiar archivos antiguos (más de 1 hora).
 *  - Generar archivos MP3 a partir de texto con MsEdgeTTS.
 *  - Convertir dichos archivos a WAV para Asterisk.
 *  - Eliminar archivos temporales luego de su uso.
 */
class TTSHandler {
    /**
     * Crea una instancia de TTSHandler e inicializa MsEdgeTTS.
     * También hace un seguimiento de los archivos temporales generados.
     * @param {boolean} [startServer=true] - Si es true, inicia el servidor AGI
     */
    constructor(startServer = true) {
        this.tts = new MsEdgeTTS();
        this.tempFiles = new Set();
        this.initTempDir();
    }

    /**
     * Inicializa el directorio temporal y limpia archivos antiguos.
     * @returns {Promise<void>} Retorna una Promesa que se resuelve una vez realizado el proceso.
     */
    async initTempDir() {
        try {
            await fs.mkdir(TMP_DIR, { recursive: true });
            console.log(`Directorio temporal creado: ${TMP_DIR}`);
            // Limpiar archivos antiguos al iniciar
            await this.cleanOldFiles();
        } catch (error) {
            console.error('Error al crear directorio temporal:', error);
        }
    }

    /**
     * Limpia archivos temporales antiguos (más de 1 hora).
     * @returns {Promise<void>} Retorna una Promesa que se resuelve luego de eliminar los archivos antiguos.
     */
    async cleanOldFiles() {
        try {
            const files = await fs.readdir(TMP_DIR);
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);

            for (const file of files) {
                const filePath = join(TMP_DIR, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.mtimeMs < oneHourAgo) {
                        await fs.unlink(filePath);
                        console.log(`Archivo antiguo eliminado: ${filePath}`);
                    }
                } catch (err) {
                    console.error(`Error al procesar archivo: ${filePath}`, err);
                }
            }
        } catch (error) {
            console.error('Error al limpiar archivos antiguos:', error);
        }
    }

    /**
     * Genera un archivo de audio MP3 a partir de texto.
     * @param {string} text - Texto a convertir en audio.
     * @param {string} [language='es'] - Idioma para la síntesis de voz (por defecto 'es').
     * @returns {Promise<string>} Ruta completa del archivo MP3 generado.
     */
    async generateTTSFile(text, language = 'es') {
        console.log(`Generando archivo TTS en idioma: ${language}`);
        const voice = VOICE_CONFIG[language] || VOICE_CONFIG['es'];
        await this.tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

        const uniqueFileName = uuidv4();
        const filePath = join(TMP_DIR, `${uniqueFileName}.mp3`);
        
        await this.tts.toFile(filePath, text);
        this.tempFiles.add(filePath);
        console.log('Archivo TTS generado:', filePath);
        return filePath;
    }

    /**
     * Convierte un archivo MP3 a WAV con formato para Asterisk (8kHz, mono).
     * @param {string} sourceFilePath - Ruta completa del archivo MP3 de origen.
     * @returns {Promise<string>} Ruta completa del archivo WAV convertido.
     */
    async convertAudioFile(sourceFilePath) {
        console.log('Convirtiendo archivo de audio...');
        const convertedFilePath = sourceFilePath.replace('.mp3', '_converted.wav');
        this.tempFiles.add(convertedFilePath);

        return new Promise((resolve, reject) => {
            const job = transcode(sourceFilePath, convertedFilePath, {
                sampleRate: 8000,
                format: 'wav',
                channelCount: 1,
            });

            job.on('error', reject);
            job.on('end', () => {
                console.log('Archivo convertido:', convertedFilePath);
                resolve(convertedFilePath);
            });

            job.start();
        });
    }

    /**
     * Limpia los archivos temporales generados.
     * @param  {...string} filePaths - Lista de rutas de archivos a eliminar.
     * @returns {Promise<void>} Retorna una Promesa que se resuelve luego de la eliminación.
     */
    async cleanUpFiles(...filePaths) {
        const cleanupPromises = [];

        // Procesar archivos específicos y registrados
        const allFiles = new Set([...filePaths, ...this.tempFiles]);
        
        for (const filePath of allFiles) {
            if (!filePath) continue;
            cleanupPromises.push(this.deleteFile(filePath));
        }

        try {
            await Promise.allSettled(cleanupPromises);
            this.tempFiles.clear();
        } catch (error) {
            console.error('Error durante la limpieza de archivos:', error);
        }
    }

    /**
     * Elimina un archivo individual de disco.
     * @param {string} filePath - Ruta del archivo a eliminar.
     * @returns {Promise<void>} Retorna una Promesa que se resuelve cuando el archivo es eliminado o si no existe.
     */
    async deleteFile(filePath) {
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            console.log(`Archivo temporal ${filePath} eliminado con éxito.`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`Error al eliminar archivo temporal ${filePath}:`, err);
            }
        }
    }
}

/**
 * Maneja la respuesta DTMF del usuario.
 * @param {object} channel - Objeto que representa el canal de Asterisk.
 * @param {object} result - Resultado devuelto por la función getData o similar.
 * @returns {Promise<boolean>} Devuelve true si se pudo manejar el dígito correctamente, false en caso contrario.
 */
async function handleDTMFResponse(channel, result) {
    if (!result?.relevantResult?.digits) {
        console.log('No se recibió dígito válido');
        return false;
    }

    const digit = result.relevantResult.digits[0];
    console.log(`Dígito recibido: ${digit}`);

    try {
        await channel.setExtension(digit);
        await channel.setPriority(1);
        await channel.setContext(channel.request.context);
        return true;
    } catch (error) {
        console.error('Error al manejar DTMF:', error);
        return false;
    }
}

/**
 * Manejador principal de llamadas.
 * @param {object} channel - Objeto que representa el canal de Asterisk, con información de la llamada.
 * @returns {Promise<void>} No retorna valor, maneja la llamada de manera asíncrona.
 */
async function handleCall(channel) {
    console.log(`Llamada entrante de ${channel.request.callerid}, desde la extensión ${channel.request.extension}`);
    
    const ttsHandler = new TTSHandler();
    let ttsFilePath, convertedFilePath;

    try {
        const textToSpeak = channel.request.arg_1;
        const language = channel.request.arg_2 || 'es';
        const waitForDigit = channel.request.arg_3 === 'any';

        if (!textToSpeak) {
            console.log('No se ha recibido texto para convertir a voz.');
            return;
        }

        ttsFilePath = await ttsHandler.generateTTSFile(textToSpeak, language);
        convertedFilePath = await ttsHandler.convertAudioFile(ttsFilePath);

        if (waitForDigit) {
            console.log('Esperando entrada DTMF...');
            const result = await channel.getData(
                convertedFilePath.replace('.wav', ''),
                5000,
                1
            );
            
            console.log('Resultado getData:', JSON.stringify(result, null, 2));
            
            if (!result.failure) {
                await handleDTMFResponse(channel, result);
            } else {
                console.log('Falló la obtención del dígito DTMF');
            }
        } else {
            await channel.streamFile(convertedFilePath.replace('.wav', ''));
        }

    } catch (error) {
        console.error("Error durante el manejo de la llamada:", error);
    } finally {
        try {
            await ttsHandler.cleanUpFiles(ttsFilePath, convertedFilePath);
        } catch (error) {
            console.error("Error durante la limpieza final:", error);
        }
    }
}

let server;

// Solo iniciar el servidor si no estamos en modo CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    // Iniciar servidor AGI
    server = new AGIServer(handleCall, { port: 4573 });
    console.log('Servidor AGI iniciado en puerto 4573');

    // Manejo de errores del servidor
    server.on('error', (error) => {
        console.error('Error en el servidor AGI:', error);
    });

    // Limpieza periódica de archivos temporales cada hora
    setInterval(async () => {
        const ttsHandler = new TTSHandler(false);
        await ttsHandler.cleanOldFiles();
    }, 60 * 60 * 1000);

    // Manejo de cierre del proceso
    process.on('SIGINT', async () => {
        console.log('Cerrando servidor...');
        // Limpiar archivos antes de cerrar
        const ttsHandler = new TTSHandler(false);
        await ttsHandler.cleanOldFiles();
        process.exit(0);
    });
}

export { TTSHandler };
export default server;