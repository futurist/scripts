'use strict';
var Stream = require('stream');
var qs = require('qs');
var moment = require('moment');
var _ = require('lodash');
var config = require('../config');
var pkg = require('../package.json')

let { prefix } = config
prefix = !prefix
  ? ''
  : prefix === true
    ? `/${pkg.name}`
    : prefix === '/' ? '' : prefix

const express = require('express')
const app = express()
app.all('*', (req, res)=>{
  console.log(req.path, req.headers, req)
  res.end()
})
var server = app.listen(9999)


var sseMap = new Map()
var sseConn = {}

var GLOBAL_COUNT=0
function NewID () {
  GLOBAL_COUNT++
  return (Date.now()+Math.random()).toString(36).replace('.', GLOBAL_COUNT.toString(36))
}

function toStreamString(arr=[':sample']){
  return arr.join('\n')+'\n\n'
}

function writeStream(stream, obj, event, callback){
  if(!_.isObject(obj)) return
  const arr = []
  const ID = obj.eventId
  if(ID) arr.push(`id:${ID}`)
  if(event) arr.push(`event:${event}`)
  arr.push(`data:${JSON.stringify(obj)}`)
  return stream.write(toStreamString(arr), callback)
}

/**
 * @api {get|post|put|patch|delete|options|trace} /ssend
 * @nowrap
 */
exports.sseEnd = function (req, res) {
  var {sseUserID} = req.cookies;
  [...sseMap.keys()].filter(r=>r.cookies.sseUserID === sseUserID).forEach(r=>{
    const sendStream = sseMap.get(r)
    sseMap.delete(r)
    if(!sendStream.isEnd) {
      writeStream(sendStream, {close: true}, 'close', ()=>{
        sendStream.end()
      })
    }
  })
}

/**
 * @api {get|post|put|patch|delete|options|trace} /sse
 * @nowrap
 */
exports.asdf = function (req, res) {

    var {sseUserID} = req.cookies
    var {xusername, id: userId} = req.session.userInfo || {}

    // setup request
    delete req.headers['etag']
    req.socket.setTimeout(0)
    req.socket.setNoDelay(true)
    req.socket.setKeepAlive(true)

    // setup send stream
    var sendStream = new Stream.PassThrough()
    sseMap.set(req, sendStream)

    var keepInterval = setInterval(()=>{
      sendStream.write(': keep-alive\n\n')
    }, 2000)
  
    const cleanUp = sendStream.cleanUp = req.cleanUp = function() {
      sseMap.delete(req)
      clearInterval(keepInterval)
      console.log('stream closed', sseUserID, sseMap.size)
    }
  
    console.log('new stream client', userId, xusername, sseUserID, sseMap.size)
    
    // writeReq(req, {id:1, type:'notify', attributes:{
    //   title:'abcasdf'
    // }})
  
    sendStream.once('finish', ()=>{
      sendStream.isEnd = true
      cleanUp()
    })
    
    // setup response
    res.status(200)
    res.type('text/event-stream')
    res.header("Connection", "keep-alive")
    if(!sseUserID) {
      sseUserID = NewID()
      res.header("Set-Cookie", "sseUserID="+ sseUserID +"; Max-Age=999999; Path=/")
    } else {
      [...sseMap.keys()].filter(r=>r !== req && r.cookies.sseUserID === sseUserID).forEach(r=>{
        const sendStream = sseMap.get(r)
        sseMap.delete(r)
        writeStream(sendStream, {close: true}, 'close', ()=>{
          sendStream.end()
        })
      })
    }
    res.header("Cache-Control", "no-cache")
    res.header("Content-Encoding", "identity")

    sendStream.pipe(res)

    // clean up
    req.once('finish', cleanUp)
    req.once("disconnect", cleanUp)

    // startup message
    writeStream(sendStream, {time:new Date, user:req.user}, 'startup')
}

