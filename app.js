(function(){
    //必要なモジュールを呼び出して準備する
    var sys = require ('sys'),
    url = require('url'),
    http = require('http'),
    qs = require('querystring'),
    request = require('request');

    var token = 'EAAPdVaHgeuEBAIYKTEZAn9duqGdlolnhwxCCNACJA04hKyjyChiBmqYwOlkW72eA7MwzY7kdxxaIbZByXFho2Yea9OYn4kEzhoOPSJkLqRe1CAKeSnZA741dA8GF2iuiSpKsdXmy1S6FXg1qLOcNq12XYRtXiSP4XRrsR7ZBWwZDZD';
    //住所情報を取得する処理をまとめておく
    var AddressManager = function(){
        this.zipcode = '';  //ex.100-1234
    };

    AddressManager.prototype = {
        endpoint:'http://itunes.apple.com/search?term=',
//        parseZipcode:function(freetext){
//            var code;
//            if(code = freetext.match(/\d{3}\-\d{4}/)){
//                return code[0].split('-');
//            } else {
//                return [];
//            }
//        },
        parseArtist:function(freetext){
              var code;
              if(code = freetext.match(/(\S+)のおすすめは何ですか？/)){
                  return code[1];
              }else{
                  return [];
              }
        },
        getAddress:function(freetext, onSuccess, onError){
              var parsedArtist = this.parseArtist(freetext);
                if(!parsedArtist) {
                    onError();
                    return; 
                }
            //freetext=ユーザーが送ってきたワード
//            var parsedCodes = this.parseZipcode(freetext);
//            if(!parsedCodes) {
//                onError();
//                return; 
//            }
            http.get(this.endpoint+encodeURIComponent(parsedArtist)+'&country=jp&media=music&attribute=artistTerm&limit=1', function(res) {
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
        //POSTのみ受け付ける　webhookにリクエストを送る
        if(req.method=='POST') {
            var body='';
            //送信されたデータの受信
            req.on('data', function (data) {
                body +=data;
            });
            req.on('end',function(){
                //querystringはクエリ文字列をオブジェクトに変換してくれる
                qs.parse(body);
                //JSON.parse() メソッドは JSON 文字列をパースし、 JavaScript のオブジェクトに変換します
                //正常にリクエストが受け付けられたら、レスポンスでテキストを返す
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
        //リクエストのメッセテキストの有無で場合分け
//{
//  "object":"page",
//  "entry":[
//    {
//      "id":"PAGE_ID",
//      "time":1460245674269,
//      "messaging":[
//        {
//          "sender":{
//            "id":"USER_ID"
//          },
//          "recipient":{
//            "id":"PAGE_ID"
//          },
//          "timestamp":1460245672080,
//          "message":{
//            "mid":"mid.1460245671959:dad2ec9421b03d6f78",
//            "seq":216,
//            "text":"hello"
//          }
//        }
//      ]
//    }
//  ]
//}
        if (messaging_events.length > 0) {
            event = messaging_events[0];
            sender = event.sender.id;
            if (event.message && event.message.text) {
                text = event.message.text;
            }
        }
        var manage = new AddressManager();
        manage.getAddress(text, function(result){
            //メッセージの部分
            var messageData = {
                attachment:{
                    type:"audio",
                    payload:{
                        url: result.results[0].previewUrl
                    }
                }
            };
            //フェイスブックページのメッセの返答部分
            request({
                url: 'https://graph.facebook.com/v2.6/me/messages',
                qs: {access_token:token},
                method: 'POST',
                json: {
                    recipient: {id:sender},
                    message: messageData
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
