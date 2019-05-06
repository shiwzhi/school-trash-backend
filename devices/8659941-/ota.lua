trig = 2
echo = 7
vcc = 1
gnd = 6

gpio.mode(vcc, gpio.OUTPUT)
gpio.mode(gnd, gpio.OUTPUT)
gpio.mode(trig, gpio.OUTPUT)
gpio.mode(echo, gpio.INT)
gpio.write(vcc, gpio.HIGH)
gpio.write(gnd, gpio.HIGH)

gpio.write(vcc, gpio.LOW)
gpio.write(gnd, gpio.LOW)

gpio.write(vcc, gpio.HIGH)
gpio.write(gnd, gpio.LOW)

result = 0
old = 0
new = 0
count = 0
function echo_interrupt(level, when)
    if level == gpio.HIGH then
        old = when
    else
        new = when
        result = (new - old) / 58
        if (count < 5) then
            count = count + 1
            tmr.create():alarm(
                200,
                tmr.ALARM_SINGLE,
                function()
                    measure()
                end
            )
        else
        end
    end
end
gpio.trig(echo, "both", echo_interrupt)

function measure()
    gpio.write(trig, gpio.LOW)
    gpio.write(trig, gpio.HIGH)
    tmr.delay(10)
    gpio.write(trig, gpio.LOW)
end

measure()
if
    not tmr.create():alarm(
        2000,
        tmr.ALARM_SINGLE,
        function()
            net.cert.verify(true)

            function upload_data(measure)
                sensor_data = {}
                sensor_data["data"] = tostring(measure)
                upload_data = {}
                upload_data["sensor_data"] = sensor_data
                upload_data["deviceid"] = tostring(node.chipid())

                ok, json = pcall(sjson.encode, upload_data)
                
                
            end

            upload_data(result)
        end
    )
 then
    print("whoopsie")
end
