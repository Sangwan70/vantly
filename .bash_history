#1767155823
clear
#1767155825
cd extra/
#1767155826
ls
#1767155829
ls -l
#1767155837
ls artifacts/
#1767155850
chmod 0777 -R artifacts/
#1767156203
ls
#1767156207
ls artifacts/
#1767156208
ls
#1767156218
ls extensions/theskillpedia/
#1767156234
chmod 0777 -R extensions/
#1767156270
chmod 0755 -R extensions/
#1767156273
ls
#1767156866
mkdir testing
#1767156871
mv plugin.zip testing/
#1767156884
unzip -l plugin.zip | awk '{print $4}' | grep -i 'composer.json' || echo 'composer.json not found'
#1767156893
ls
#1767156897
cd testing/
#1767156900
ls
#1767156903
unzip -l plugin.zip | awk '{print $4}' | grep -i 'composer.json' || echo 'composer.json not found'
#1767156928
unzip -p plugin.zip composer.json | sed -n '1,200p'
#1767156998
unzip -p plugin.zip composer.json | file -bi -
#1767157449
cd testing/plugin.zip 
#1767157454
cd testing/
#1767157456
unzip -p plugin.zip composer.json | od -An -t x1 -N 3 | sed "s/ //g" || true
#1767158416
pip3 install jq
#1767158433
pip install jq
#1767158442
jq
#1767158452
exit
#1767158584
cp testing/plugin.zip ./extra/extensions/theskillpedia/
#1767158594
cd ./extra/extensions/theskillpedia/
#1767158601
mkdir brevo
#1767158607
mv plugin.zip brevo/
#1767158610
cd brevo/
#1767158617
unzip plugin.zip 
#1767158619
ls
#1767158623
rm plugin.zip 
#1767158625
ls
#1767158627
cd 
#1767158642
composer require theskillpedia/brevo
#1767158819
clear
#1767158825
rm -rf var/cache/*
#1767791503
exit
#1767791638
ls
#1767791647
unzip excel-feature-patch.zip 
#1767791651
clear
#1767791659
cd excel-feature-patch
#1767791661
ls
#1767791672
cp -r * ~/
#1767791676
cd
#1767791680
cd resources/
#1767791682
ls -al
#1767791695
cd views/
#1767791696
ls
#1767791702
ls -l
#1767791722
cd
#1767791726
cd excel-feature-patch
#1767791728
ls
#1767791731
cd tree
#1767791733
tree
#1767791751
ls -l ~/resources/views/templates/admin/
#1767791763
cd
#1767791774
rm -rf var/cache/*
#1767792984
composer require phpoffice/phpspreadsheet:^5.3
#1767792999
rm -rf var/cache/*
#1767793225
clear
#1767793234
history
#1767793247
history | grep jindal
#1767793254
history | grep jin
#1767793257
exit
#1786650399
ls -l
#1786650403
pwd
#1786650405
clear
#1786650409
docker ps -a
#1786650430
podman ps -a
#1786650787
exit
#1786688054
docker ps -a
#1786688064
id jaats
#1786688081
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
#1786688146
clear
#1786688150
exit
#1786688199
clear
#1786688200
ls
#1786688232
rm -rf bootstrap    composer.lock  data      etc        LICENSE   package-lock.json  phpmd.xml       public             README.md      ci             config    docs       extra    locale  migrations       
#1786688234
ls
#1786688258
rm -rf package.json  phpcs.xml.dist     phpunit.xml composer.json  error_log   vite.config.mjs
#1786688260
ls
#1786688284
rm -rf  resources  src  testing   var  vendor  VERSION  cron.php  helpers  
#1786688289
ls -a
#1786688319
rm -rf .env  .env.example .myimunify_id 
#1786688322
ls -al
#1786688330
cd public_html/
#1786688331
clear
#1786688332
ls
#1786688335
rm -rf *
#1786688336
ls
#1786688338
ls -a
#1786688345
rm -rf .htaccess .vite/
#1786688347
clear
#1786688348
ls
#1786688350
pwd
#1786688547
clear
#1786688549
cd ..
#1786688573
git clone https://github.com/gitroomhq/postiz-app.git
#1786688578
ls
#1786688585
mv postiz-app/ postiz/
#1786688588
cd postiz/
#1786688589
clear
#1786688589
ls
#1786688599
docker compose up -d --build
#1786688874
cd ..
#1786688882
vi public_html/.htaccess
#1786688891
cd postiz/
#1786688899
docker compose ps -a
#1786689152
clear
#1786689162
iptables -L
#1786689167
exit
#1786689679
cd postiz/
#1786689686
docker compose down 
#1786689712
docker compose down -v
#1786689724
exit
#1786697275
clear
#1786697276
ls
#1786697279
cd postiz/
#1786697281
clear
#1786697286
docker compose ps -a
#1786697307
docker compose up -d 
#1786697315
docker compose up -d --build
#1786697329
docker compose build --no-cache
#1786697340
docker compose up -d
#1786697386
docker compose docker compose down -v && docker system prune -a -f --volumes
#1786697389
docker compose down -v && docker system prune -a -f --volumes
#1786697395
clear
#1786697398
docker compose up -d
#1786697790
docker compose ps -a
#1786698111
clear
#1786698344
ls -a
#1786698377
ls -al
#1786698397
cp .env.example .env
#1786698400
vi .env
#1786698540
docker compose down
#1786698574
docker compose up -d --build
#1786698584
docker compose up -d 
#1786698601
exit
#1786699721
cd postiz/
#1786699725
docker compose up -d
#1786699732
docker compose down
#1786699748
exit
#1786699942
cd postiz/
#1786699954
docker compose up -d --build
#1786699968
docker compose down -v && docker system prune -a -f --volumes
#1786700084
docker system prune
#1786700112
docker compose up -d --build
#1786700117
docker compose down -v && docker system prune -a -f --volumes
#1786700126
exit
#1786700910
clear
#1786700913
cd postiz
#1786700914
ls
#1786700943
systemctl status docker
#1786700947
exit
#1786729093
ls
#1786729099
cd postiz/
#1786729104
ls
#1786729285
exit
#1786730441
systemctl status docker
#1786730447
cd postiz
#1786730448
clear
#1786730457
docker compose ps -a
#1786730470
exit
#1786738457
cd postiz/
#1786738459
clear
#1786738466
vi docker-compose.yaml 
#1786739024
exit
