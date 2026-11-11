import {defineConfig} from 'vite';
export default defineConfig(({command})=>({publicDir:command==='serve'?'public':false,build:{chunkSizeWarningLimit:600,rolldownOptions:{output:{codeSplitting:{groups:[{name:'three',test:/node_modules\/three\/(src|build)\//}]}}}},server:{port:5187,strictPort:true},preview:{port:5188,strictPort:true}}));
