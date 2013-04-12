openssl genrsa -out privatekey.pem 1024 
openssl req -new -key privatekey.pem -out certrequest.csr 
openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
openssl pkcs8 -topk8 -nocrypt -in privatekey.pem -inform PEM -out privatekey.der -outform DER
openssl x509 -in certificate.pem -inform PEM -out certificate.der -outform DER