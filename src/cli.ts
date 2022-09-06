#!/usr/bin/env node
import { main } from './InterfaceDetector';
main(process.argv[2]).catch((e) => console.error(e));
