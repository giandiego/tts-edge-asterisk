#!/usr/bin/env node

import { program } from 'commander';
import { TTSHandler } from './index.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';

// Configurar el CLI
program
    .name('tts-edge-cli')
    .description('CLI para generar archivos de audio usando Microsoft Edge TTS')
    .version('1.0.0')
    .requiredOption('-t, --text <text>', 'Texto a convertir en audio')
    .requiredOption('-o, --output <file>', 'Archivo de salida')
    .option('-l, --lang <language>', 'Idioma (es, en, fr, pt, de)', 'es')
    .option('-r, --rate <rate>', 'Tasa de muestreo en Hz', '8000')
    .parse(process.argv);

const options = program.opts();

async function main() {
    try {
        // Crear el directorio de salida si no existe
        await fs.mkdir(dirname(options.output), { recursive: true });

        // Inicializar el manejador TTS
        const ttsHandler = new TTSHandler(false); // Pasar false para no iniciar el servidor
        
        // Generar el archivo MP3
        console.log('Generando archivo de audio...');
        const mp3File = await ttsHandler.generateTTSFile(options.text, options.lang);
        
        // Convertir a WAV con la tasa de muestreo especificada
        console.log('Convirtiendo archivo...');
        const wavFile = await ttsHandler.convertAudioFile(mp3File);
        
        // Copiar el archivo convertido a la ubicación final
        await fs.copyFile(wavFile, options.output);
        console.log(`Archivo de audio generado exitosamente: ${options.output}`);
        
        // Limpiar archivos temporales
        await ttsHandler.cleanUpFiles(mp3File, wavFile);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main(); 