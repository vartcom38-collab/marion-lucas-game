<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function reply(int $s,array $d):never{http_response_code($s);echo json_encode($d,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST') reply(405,['ok'=>false,'error'=>'method']);
$auth=(string)($_SERVER['HTTP_AUTHORIZATION']??'');
$provided=str_starts_with($auth,'Bearer ')?substr($auth,7):'';
$secret=(string)getenv('MONIA_MEDIA_BRIDGE_TOKEN');
$valid=$secret!==''&&$provided!==''&&hash_equals($secret,$provided);
if(!$valid){
    $hashFile=__DIR__.'/.monia-reference-bridge-auth.php';
    if(is_file($hashFile)){
        $hash=include $hashFile;
        $valid=is_string($hash)&&$hash!==''&&$provided!==''&&password_verify($provided,$hash);
    }
}
if(!$valid) reply(403,['ok'=>false,'error'=>'auth']);
$kind=(string)($_POST['kind']??'image');
if(!in_array($kind,['image','video','audio'],true)) reply(400,['ok'=>false,'error'=>'kind']);
if(!isset($_FILES['file'])||!is_uploaded_file($_FILES['file']['tmp_name'])) reply(400,['ok'=>false,'error'=>'file']);
$tmp=$_FILES['file']['tmp_name']; $size=(int)$_FILES['file']['size'];
$max=$kind==='video'?80*1024*1024:($kind==='audio'?24*1024*1024:16*1024*1024);
if($size<256||$size>$max) reply(413,['ok'=>false,'error'=>'size']);
$finfo=new finfo(FILEINFO_MIME_TYPE); $mime=(string)$finfo->file($tmp);
$allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm','audio/wav'=>'wav','audio/mpeg'=>'mp3','audio/ogg'=>'ogg'];
if(!isset($allowed[$mime])||!str_starts_with($mime,$kind.'/')) reply(415,['ok'=>false,'error'=>'mime','mime'=>$mime]);
$root=dirname(__DIR__).'/resources/monia/bridge'; if(!is_dir($root)&&!mkdir($root,0755,true)) reply(500,['ok'=>false,'error'=>'storage']);
$name=hash_file('sha256',$tmp).'.'.$allowed[$mime]; $target=$root.'/'.$name;
if(!file_exists($target)&&!move_uploaded_file($tmp,$target)) reply(500,['ok'=>false,'error'=>'write']);
reply(200,['ok'=>true,'url'=>'/resources/monia/bridge/'.$name,'mime'=>$mime,'bytes'=>$size]);
