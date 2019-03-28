var mongoUtil = require('./mongoUtil');

const express = require('express')
var bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())
const port = 3001


mongoUtil.connectToServer(function (err) {

    var db = mongoUtil.getDb()

    app.post("/regdevice", (req, res) => {
        var reg = req.body
        reg.regTime = Math.floor(Date.now() / 1000).toString()
        db.collection('device').updateOne({ deviceid: reg.deviceid }, { $addToSet: { "regTime": reg.regTime, "devicetime": reg.devicetime }, $set: {'latestRegTime': reg.regTime} }, { upsert: true }).then((result) => {
            console.log(result.result)
        })
        var deviceid = req.body.deviceid
        db.collection('device').find({ deviceid: deviceid }).toArray().then((result) => {
            try {
                res.send(result[0].devicecode)
            } catch (error) {
                console.log("can't get device code")
                res.send("print('cant get device code')")
            }
        })
    })

    app.post("/uploaddata", (req, res) => {
        
        db.collection('device').updateOne({ deviceid: req.body.deviceid }, { $push: { "sensor_data": req.body.sensor_data }, $set:{'latestData': req.body.sensor_data} }, { upsert: true }).then((result) => {
            console.log(result.result)
            res.send("uploaded")
        })
    })


    app.get('/devices', (req, res) => {
        var db = mongoUtil.getDb()
        db.collection('device').find({}).toArray().then((result) => {
            res.json(result)
        })
    })

    app.get('/device', (req, res) => {
        var db = mongoUtil.getDb()
        var deviceid = req.query.deviceid
        db.collection('device').find({ deviceid: deviceid }).toArray().then((result) => {
            res.json(result)
        })
    })

    app.post('/updatedevice', (req, res) => {
        console.log("/updatedevice")
        var db = mongoUtil.getDb()
        var device = req.body.device
        db.collection('device').updateOne({ deviceid: device.deviceid }, { $set: { "deviceinfo": device.deviceinfo, "devicecode": device.devicecode } }, { upsert: true }).then((result) => {
            res.json(result)
        })
        client.publish("/device/esp/" + device.deviceid + "/code", device.devicecode, { qos: 2, retain: true }, () => { console.log("code published") })
    })



    // check if device regtime within sleep time 

    function intervalFunc() {
        db.collection('device').find({}).toArray().then((result) => {
            result.map((device) => {
                try {
                    var lapse = Math.floor(Date.now() / 1000) - parseInt(device.latestRegTime)
                    if (lapse < 3600*3.5) {
                        db.collection('device').updateOne({deviceid: device.deviceid}, {$set: {"devicestatus": "正常"}}, {upsert: true})
                    } else {
                        db.collection('device').updateOne({deviceid: device.deviceid}, {$set: {"devicestatus": "离线"}}, {upsert: true})
                    }
                } catch (error) {
                    console.log("update status error")
                }
            })
        })
    }

    setInterval(intervalFunc, 10000);

});

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))