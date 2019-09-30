cd custimage
docker build . --tag 'nginx:custom'
cd ..
docker save nginx:custom > 1.tar

