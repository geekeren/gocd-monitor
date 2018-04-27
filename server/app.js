'use strict';

import express from 'express';
import path from 'path';
import Logger from './utils/Logger';
import socketio from 'socket.io';
import { parseString } from 'xml2js';

import * as conf from '../app-config';
import GoService from './services/GoService';


const routes = require('./routes/index'),
      dev = require('./routes/dev'),
      app = express(),
      io = socketio(),
      devMode = app.get('env') === 'development',
      goService = new GoService();

const AipSpeechClient = require("baidu-aip-sdk").speech;

// 设置APPID/AK/SK
const APP_ID = conf.baiduAipAPP_ID;
const API_KEY = conf.baiduAipAPI_KEY;
const SECRET_KEY = conf.baiduAipSECRET_KEY;

// 新建一个对象，建议只保存一个对象调用服务接口
const client = new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY);
// view engine setup
app.set('views', path.join(__dirname, 'views'));

// Use webpack server to serve static assets in development and express.static
// for all other stages
if (devMode) {
  app.use('/assets/js', dev);
}
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.get('/speak', (req, res, next) => {
    const fs = require('fs');
    if(req.query.content){
        client.text2audio(req.query.content, {spd: 5, per: 4, vol: 10}).then(function(result) {
            if (result.data) {
                fs.writeFileSync('tmp/audio/tts.mpVoice.mp3', result.data);
                res.sendFile('tts.mpVoice.mp3', { root: 'tmp/audio' });
            } else {
                console.log(result)
            }
        }, function(e) {
            console.log(e)
        });
    } else {
        res.send('');
    }
});
app.use('/', routes);

app.use((req, res, next) => {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.sendFile('error-' + err.status + '.html', { root : 'server/views' });
});

// Start polling go server
goService.start();

// socket.io setup
app.io = io;

io.on('connection', (socket) => {
  Logger.debug('Client connected');
  goService.registerClient(socket);

  socket.on('disconnect', () => {
    Logger.debug('Client disconnected');
    goService.unregisterClient(socket);
  });
});

module.exports = app;
