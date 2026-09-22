<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$id=(string)($_GET['id']??'');
if(!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,80}$/',$id)){http_response_code(400);echo json_encode(['ok'=>false,'error'=>'id invalide']);exit;}
$base=dirname(__DIR__).'/resources/monia/candidates/'.$id;
$result=$base.'/result.json';
if(!is_file($result)){http_response_code(202);echo json_encode(['ok'=>true,'jobId'=>$id,'state'=>'generating']);exit;}
$data=json_decode((string)file_get_contents($result),true);
if(!is_array($data)){http_response_code(500);echo json_encode(['ok'=>false,'jobId'=>$id,'state'=>'invalid-result']);exit;}
$clips=[];foreach((array)($data['clips']??[]) as $name){if(is_string($name)&&preg_match('/^shot-[0-9]+\\.mp4$/',$name)&&is_file($base.'/'.$name))$clips[]='/resources/monia/candidates/'.rawurlencode($id).'/'.rawurlencode($name);}
$quality=null;$qualityFile=$base.'/quality-v3.json';if(is_file($qualityFile)){$q=json_decode((string)file_get_contents($qualityFile),true);if(is_array($q))$quality=$q;}
$continuityLastFrame=is_file($base.'/continuity-last-frame.jpg')?'/resources/monia/candidates/'.rawurlencode($id).'/continuity-last-frame.jpg':null;
$authority=$data['narrativeAuthority']??null;
echo json_encode(['ok'=>true,'jobId'=>$id,'state'=>'candidate','candidateOnly'=>($data['candidateOnly']??null)===true,'narrativeAuthority'=>$authority,'narrativeAuthorityDisabled'=>$authority===false,'clips'=>$clips,'quality'=>$quality,'continuityLastFrame'=>$continuityLastFrame,'result'=>$data],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
