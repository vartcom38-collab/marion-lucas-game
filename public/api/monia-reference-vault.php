<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $s,array $d):never{http_response_code($s);echo json_encode($d,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
function auth_ok():bool{
    $auth=(string)($_SERVER['HTTP_AUTHORIZATION']??'');
    $provided=str_starts_with($auth,'Bearer ')?substr($auth,7):'';
    $secret=(string)getenv('MONIA_MEDIA_BRIDGE_TOKEN');
    if($secret!==''&&$provided!==''&&hash_equals($secret,$provided)) return true;
    $hashFile=__DIR__.'/.monia-reference-bridge-auth.php';
    if(is_file($hashFile)){
        $hash=include $hashFile;
        if(is_string($hash)&&$hash!==''&&$provided!==''&&password_verify($provided,$hash)) return true;
    }
    return false;
}
function safe_id(string $v):string{
    $v=strtolower(trim($v));
    $v=preg_replace('/[^a-z0-9._-]+/','-',$v)??'';
    $v=trim($v,'-._');
    return substr($v,0,120);
}
if(!auth_ok()) reply(403,['ok'=>false,'error'=>'auth']);

$root=dirname(__DIR__).'/private/monia/reference-vault';
if(!is_dir($root)&&!mkdir($root,0750,true)) reply(500,['ok'=>false,'error'=>'storage']);

$method=(string)($_SERVER['REQUEST_METHOD']??'GET');

if($method==='POST'){
    if(!isset($_FILES['file'])||!is_uploaded_file($_FILES['file']['tmp_name'])) reply(400,['ok'=>false,'error'=>'file']);
    $character=safe_id((string)($_POST['character']??''));
    $refId=safe_id((string)($_POST['ref_id']??''));
    if($character===''||$refId==='') reply(400,['ok'=>false,'error'=>'character_or_ref_id']);
    $tmp=$_FILES['file']['tmp_name'];
    $size=(int)$_FILES['file']['size'];
    if($size<256||$size>250*1024*1024) reply(413,['ok'=>false,'error'=>'size']);
    $finfo=new finfo(FILEINFO_MIME_TYPE);
    $mime=(string)$finfo->file($tmp);
    $allowed=[
      'image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp',
      'video/mp4'=>'mp4','video/webm'=>'webm',
      'audio/wav'=>'wav','audio/mpeg'=>'mp3','audio/ogg'=>'ogg'
    ];
    if(!isset($allowed[$mime])) reply(415,['ok'=>false,'error'=>'mime','mime'=>$mime]);
    $dir=$root.'/'.$character.'/'.$refId;
    if(!is_dir($dir)&&!mkdir($dir,0750,true)) reply(500,['ok'=>false,'error'=>'mkdir']);
    foreach(glob($dir.'/source.*')?:[] as $old){@unlink($old);}
    $target=$dir.'/source.'.$allowed[$mime];
    if(!move_uploaded_file($tmp,$target)) reply(500,['ok'=>false,'error'=>'write']);
    $rolesRaw=(string)($_POST['roles']??'');
    $roles=array_values(array_filter(array_map('trim',preg_split('/[,;]+/',$rolesRaw)?:[])));
    $meta=[
      'version'=>1,
      'character'=>$character,
      'ref_id'=>$refId,
      'source_name'=>(string)($_POST['source_name']??($_FILES['file']['name']??'')),
      'roles'=>$roles,
      'mime'=>$mime,
      'bytes'=>$size,
      'sha256'=>hash_file('sha256',$target),
      'created_at'=>gmdate('c')
    ];
    file_put_contents($dir.'/metadata.json',json_encode($meta,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE));
    reply(200,['ok'=>true,'ref_id'=>$refId,'character'=>$character,'mime'=>$mime,'bytes'=>$size,'sha256'=>$meta['sha256']]);
}

if($method==='GET'){
    $character=safe_id((string)($_GET['character']??''));
    $refId=safe_id((string)($_GET['ref_id']??''));
    $mode=(string)($_GET['mode']??'file');
    if($character===''||$refId==='') reply(400,['ok'=>false,'error'=>'character_or_ref_id']);
    $dir=$root.'/'.$character.'/'.$refId;
    $metaPath=$dir.'/metadata.json';
    if(!is_file($metaPath)) reply(404,['ok'=>false,'error'=>'not_found']);
    if($mode==='meta'){
        $raw=file_get_contents($metaPath);
        http_response_code(200);
        echo $raw===false?'{}':$raw;
        exit;
    }
    $files=glob($dir.'/source.*')?:[];
    if(count($files)!==1) reply(404,['ok'=>false,'error'=>'source_not_found']);
    $path=$files[0];
    $finfo=new finfo(FILEINFO_MIME_TYPE);
    $mime=(string)$finfo->file($path);
    header('Content-Type: '.$mime);
    header('Content-Length: '.filesize($path));
    header('Content-Disposition: attachment; filename="'.basename($path).'"');
    readfile($path);
    exit;
}
reply(405,['ok'=>false,'error'=>'method']);
