import {defineConfig} from '../../node_modules/vite/dist/node/index.js';
export default defineConfig({root:process.cwd(),publicDir:'apps/web/public',server:{host:'127.0.0.1',port:5181},esbuild:{jsx:'automatic'}});
