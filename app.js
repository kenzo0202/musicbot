/**
 * node.js sample code
 * ref http://onlineconsultant.jp/pukiwiki/?node.js%20GET%20POST%E3%83%91%E3%83%A9%E3%83%A1%E3%83%BC%E3%82%BF%E3%83%BC%E3%82%92%E5%8F%96%E5%BE%97%E3%81%99%E3%82%8B
 * author Ryosuke Murai (Retty.Inc)
 */
(function(){
    //必要なモジュールを呼び出して準備する
    var sys = require ('sys'),
    url = require('url'),
    http = require('http'),
    qs = require('querystring'),
    request = require('request');

    var token = 'EAAPdVaHgeuEBALHQBwGXfpE4PMgEGWgfokZC1tGi9jInee1XjA6oBNMEU8PAUx4xwONCKRzgyLRTym9wXfTkqj4OMdzZB2JEvPPv1E5WuAlnrOpKRWcr0Cn9tZA8mrZBFrudcbgDZAHktIVir4AZBOjsaBk17jpAAPhjwKkEk9dQZDZD';
    //住所情報を取得する処理をまとめておく
    var AddressManager = function(){
        this.zipcode = '';  //ex.100-1234
    };

    AddressManager.prototype = {
        endpoint:'http://api.thni.net/jzip/X0401/JSON/',
        parseZipcode:function(freetext){
            var code;
            if(code = freetext.match(/\d{3}\-\d{4}/)){
                return code[0].split('-');
            } else {
                return [];
            }
        },
        getAddress:function(freetext, onSuccess, onError){
            console.log(freetext);
            var parsedCodes = this.parseZipcode(freetext);
            if(!parsedCodes) {
                onError();
                return; 
            }
            http.get(this.endpoint+parsedCodes[0]+'/'+parsedCodes[1]+'.js', function(res) {
                var body = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    body += chunk;
                });
                res.on('end', function() {
                    try{
                        ret = JSON.parse(body);
                        onSuccess(ret);
                    } catch(ex){
                        onError();
                    }
                });
            }).on('error', function(e) {
                onError();
            });
        }
    };


    //リクエストがある度に呼ばれる処理
    http.createServer(function (req, res) {
        //zipページに対するリクエスト以外は無視
        if (!req.url.match(/\/zip|\/\?hub\.mode/)){
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('error');
            return;
        } else if (req.url.match(/\/\?hub\.mode/)){
            //FacebookMessengerの認証対応
            var param = url.parse(req.url,true);
            if (param.query['hub.verify_token'] === 'RETTY_TOKEN') {
                res.end(param.query['hub.challenge']);
            } else {
                res.end('Error, wrong validation token');
            }
            return;
        }

        if(req.method=='POST') {
            var body='';
            //送信されたデータの受信
            req.on('data', function (data) {
                body +=data;
            });
            req.on('end',function(){
                qs.parse(body);
                sendResponse(JSON.parse(body), res);
            });
        } else if(req.method=='GET') {
            res.end('');
        }
    }).listen(process.env.PORT || 5000);

    //リクエストが正常に受け付けられた際の処理を関数化
    function sendResponse(param, response){
        var messaging_events = param.entry[0].messaging,
        replayMessages = [], text="", sender="";
        if (messaging_events.length > 0) {
            event = messaging_events[0];
            sender = event.sender.id;
            if (event.message && event.message.text) {
                text = event.message.text;
            }
        }
        var manage = new AddressManager();
        manage.getAddress(text, function(result){
            var messageData = {
                text:result.stateName+result.city+result.street
            }
            request({
                url: 'https://graph.facebook.com/v2.6/me/messages',
                qs: {access_token:'RETTY_TOKEN'},
                method: 'POST',
                json: {
                    recipient: {id:sender},
                    message: messageData,
                }
            }, function(error, response, body) {
                if (error) {
                    console.log('Error sending message: ', error);
                } else if (response.body.error) {
                    console.log('Error: ', response.body.error);
                }
            }); 
            response.end(result.stateName+result.city+result.street);
        }, function(){
            response.end('error');
        });
    }
}());
