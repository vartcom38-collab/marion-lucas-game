<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
session_name('monia_speech_performance');
session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','samesite'=>'Strict','path'=>'/']);
session_start();
function reply(int $status,array $data): never {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
function same_origin(): bool {$origin=$_SERVER['HTTP_ORIGIN']??'';if($origin==='')return true;$originHost=parse_url($origin,PHP_URL_HOST);$host=explode(':',$_SERVER['HTTP_HOST']??'')[0];return is_string($originHost)&&$host!==''&&hash_equals(strtolower($host),strtolower($originHost));}
if(!same_origin())reply(403,['ok'=>false,'error'=>'origin refusée']);
if($_SERVER['REQUEST_METHOD']!=='POST')reply(405,['ok'=>false,'error'=>'méthode refusée']);
$token=trim((string)getenv('MONIA_GITHUB_TOKEN'));if($token==='')reply(503,['ok'=>false,'error'=>'pont speech-performance non configuré']);
$raw=file_get_contents('php://input');if($raw===false||strlen($raw)>18000)reply(413,['ok'=>false,'error'=>'requête trop volumineuse']);
$data=json_decode($raw?:'',true);if(!is_array($data))reply(400,['ok'=>false,'error'=>'JSON invalide']);
$id=trim((string)($data['id']??''));$video=trim((string)($data['videoUrl']??''));$audio=trim((string)($data['audioUrl']??''));
if(!preg_match('/^speech-[a-z0-9][a-z0-9-]{5,60}$/',$id))reply(400,['ok'=>false,'error'=>'id invalide']);
foreach([$video,$audio] as $url){if(!filter_var($url,FILTER_VALIDATE_URL)||!str_starts_with($url,'https://'))reply(400,['ok'=>false,'error'=>'URL média invalide']);}
$hits=array_values(array_filter((array)($_SESSION['hits']??[]),fn($t)=>is_int($t)&&$t>time()-600));if(count($hits)>=3)reply(429,['ok'=>false,'error'=>'trop de rendus rapprochés']);$hits[]=time();$_SESSION['hits']=$hits;
$job=['id'=>$id,'videoUrl'=>$video,'audioUrl'=>$audio,'engine'=>'musetalk-v1.5','candidateOnly'=>true,'canonicalPromotion'=>false,'audioAuthority'=>'lucas-v16'];
$json=json_encode($job,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);if($json===false)reply(500,['ok'=>false,'error'=>'encodage impossible']);
$dispatch=['event_type'=>'monia_speech_performance_run','client_payload'=>['job_id'=>$id,'job_b64'=>base64_encode($json)]];
$ch=curl_init('https://api.github.com/repos/vartcom38-collab/marion-lucas-game/dispatches');if($ch===false)reply(500,['ok'=>false,'error'=>'client GitHub indisponible']);
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>6,CURLOPT_TIMEOUT=>15,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token,'Accept: application/vnd.github+json','Content-Type: application/json','User-Agent: Marion-Lucas-MonIA-Speech','X-GitHub-Api-Version: 2022-11-28'],CURLOPT_POSTFIELDS=>json_encode($dispatch,JSON_UNESCAPED_SLASHES)]);
$response=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$error=curl_error($ch);curl_close($ch);
if($response===false||$http<200||$http>=300)reply(502,['ok'=>false,'error'=>'déclenchement speech-performance impossible'.($error?' · '.$error:'')]);
reply(202,['ok'=>true,'id'=>$id,'state'=>'queued','engine'=>'musetalk-v1.5','candidateOnly'=>true]);
