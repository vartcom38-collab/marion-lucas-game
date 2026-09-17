<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status,array $data): never {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
$id=trim((string)($_GET['id']??''));if(!preg_match('/^speech-[a-z0-9][a-z0-9-]{5,60}$/',$id))reply(400,['ok'=>false,'error'=>'id invalide']);
$base='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/monia/speech-performance/'.rawurlencode($id);
$url=$base.'/result.json?ts='.time();
$ch=curl_init($url);if($ch===false)reply(500,['ok'=>false,'error'=>'client statut indisponible']);
curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>10,CURLOPT_HTTPHEADER=>['User-Agent: Marion-Lucas-MonIA-Speech-Status']]);
$body=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
if($http===404)reply(202,['ok'=>true,'id'=>$id,'state'=>'processing']);
if($body===false||$http<200||$http>=300)reply(502,['ok'=>false,'error'=>'statut speech-performance indisponible']);
$data=json_decode($body,true);if(!is_array($data)||($data['jobId']??'')!==$id)reply(502,['ok'=>false,'error'=>'résultat invalide']);
if(($data['state']??'')!=='candidate'||($data['candidateOnly']??null)!==true||($data['canonicalPromotion']??null)!==false)reply(502,['ok'=>false,'error'=>'politique candidat invalide']);
$data['ok']=true;$data['state']='ready';$data['videoUrl']='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/monia/speech-performance/'.rawurlencode($id).'/speech-synced.mp4';
reply(200,$data);
