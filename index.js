const http = require('http')
const https = require('https')
const url = require('url')
const hostname = '172.24.156.68'
const port = 8084

// const share = 'https://1drv.ms/u/s!ApJ4AJwQZDAyhYttc6GR7TgCxMqmxg?e=GCNDAW'
// const embed = 'https://onedrive.live.com/embed?cid=323064109C007892&resid=
//    323064109C007892%2183437&authkey=ANyzJ2mKTpdpkWE
    
const param_dictionary =
    {
        params: ['share', 'embed'],
        share: {
            hostname: '1drv.ms',
            func: shareRedirect
        },  
        embed: {
            hostname: 'onedrive.live.com', 
            func: embedRequest
        }
    }

    
const server = http.createServer((request, serverOut) => {
    let queries = url.parse(request.url,true).query
    if (queries === null) {
        ErrorMsg('Please specify a url.', 400, serverOut)
        return
    }

    // distribute method resolution, according to param_dictionary 

    for (i = 0; i<param_dictionary.params.length; i++){
        const query_method = param_dictionary.params[i]
        if (query_method in queries){
            const inputUrl = decodeURIComponent(
                    queries[query_method]
                ).replace('http://','https://')
            
            const valid_hostname = param_dictionary[query_method].hostname
            
            if (checkUrl(inputUrl, valid_hostname, serverOut)) 
            {
                param_dictionary[query_method].func(inputUrl, serverOut)
                return
            }else
            {
                ErrorMsg('Host name invalid.', 400, serverOut)
                return
            }

        }
    }

    ErrorMsg('No valid query methods found.', 400, serverOut)
    return

})

server.listen(port, hostname, () => {
    console.log(`server running at http://${hostname}:${port}/`)
})



function embedRequest(embedUrl, serverOut){

    let urlParams = url.parse(embedUrl,true).query
    if (urlParams === null) {
        ErrorMsg('Embed link does not contain any parameters.', 400, serverOut)
        return
    }
    if(('cid' in urlParams) && ('resid' in urlParams) 
      && ('authkey' in urlParams)){
        const firstId = urlParams.cid
        const resid = urlParams.resid
        const authKey = urlParams.authkey
        requestAPI(firstId, resid, authKey, serverOut) // send API request
    }else{
        ErrorMsg('Arguments not enough.', 400, serverOut)
        return
    }
}

function shareRedirect(shareUrl, serverOut){
    
    const param_authKey = 'authkey'
    const param_resid = 'resid'

    let response = https.get(shareUrl, (redirect_data) => {
        
        const headers = redirect_data.headers

        if (redirect_data.statusCode!==301 || headers === null 
            || !('location' in headers)){
            ErrorMsg('Request failed, MS may have changed redirect protocol.'
                , 503, serverOut)
            return
        }

        const parsedRedirectUrl = new URL(headers.location)

        const authKey = parsedRedirectUrl.searchParams.get(param_authKey)
        const resid = parsedRedirectUrl.searchParams.get(param_resid)

        if (authKey === '' || resid === ''){
            ErrorMsg(
                'Request failed, MS may have changed parameters.\n[authkey], '+
                '[resid] null.'
                , 503, serverOut
            )
            return
        }

        let re = /(.*)\!(.*)/g

        let match = re.exec(resid)

        if (match === null) {
            ErrorMsg(
                'Request failed, MS may have changed parameters. \n[resid] ' + 
                'invalid.'
                , 503, serverOut
            )
            return
        }
        const firstId = match[1]
        const secId = match[2]

        requestAPI(firstId, resid, authKey, serverOut) // send API request

    })

}

function requestAPI(firstId, resid, authKey, serverOut){
    const param_download = '@content.downloadUrl'
    let requestUrl = getAPIUrl(firstId, resid, authKey)
    let newResponse = https.get(requestUrl, (API_data) =>{

        if (API_data.statusCode!==200){
            ErrorMsg('API request failed. Query sent at ' + requestUrl
                , 503, serverOut)
            return
        }

        API_data.on('data', (d) => {
            let API_json
            try{
                API_json = JSON.parse(d.toString())
            }catch(err){
                ErrorMsg(
                    'JSON parse failed. Either the API response is not ' + 
                    'a json document, or the packet is corrupted.'
                    , 503, serverOut
                )
                return
            }

            if (API_json === null || !(param_download in API_json))
            {
                ErrorMsg(
                    'JSON parse failed. JSON has been successfully fetched'  + 
                    'at ' + requestUrl + ' , but we cannot parsed the given' +
                    ' parameter' + param_download + '.' +  
                    'Full output:\n' + d.toString
                    , 503, serverOut
                )
                return
            }
            serverOut.writeHead(301, {location:API_json[param_download]})
            serverOut.end()
          });

    })

}

function getAPIUrl(firstId, resid, authKey){
    return 'https://api.onedrive.com/v1.0/drives/' + firstId + '/items/' + 
        resid + '?select=id%2C%40content.downloadUrl&authkey=' + authKey
}

function ErrorMsg(message, code, resource){
    resource.writeHead(code,{})
    resource.write(message)
    resource.end()
}

function checkUrl(shareUrl, hostname, resource){
    let parsed_shareUrl
    try{
        parsed_shareUrl = url.parse(shareUrl, true)
    }catch(err){
        ErrorMsg('Url parse failed. \n' + shareUrl, resource)
        return false
    }

    if (!(hostname.includes(parsed_shareUrl.hostname))){
        return false
    }

    return true
}

