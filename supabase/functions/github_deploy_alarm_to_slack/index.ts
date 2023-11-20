// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import dayjs from 'https://cdn.skypack.dev/dayjs@1.11.10'

serve(async (_res) => {
  const res = await _res.json()

  //GitHub Event 헤더 추출
  const githubEvent = _res.headers.get('X-GitHub-Event')

  if (_res.method !== 'POST' && githubEvent !== 'deployment_status') {
    return new Response(
      JSON.stringify({ ok: true, error: 'invalid method' }),
      { headers: { 'Content-Type': 'text/plain' }, status: 200 },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  const { data: loadTableData, error } = await supabase
    .from('pr_alarm_to_slack')
    .select('thread_ts')
    .eq('repository_name', res.repository.name)

  if (error) {
    return new Response(
        JSON.stringify({ ok: true, error: '기존에 생성된 녀석이에요. supabase Table에 정보가 없는 친구죠' }),
      { headers: { 'Content-Type': 'text/plain' }, status: 200 },
    )
  }

// 배포 성공 되었을 때
  if (res.deployment_status?.state === 'success') {
    const userNickname = await findUserName(res.sender.id, true)
    const userKoreanName = await findUserName(res.sender.id, false)

    const createPrMessage = `
      <${res.deployment_status.target_url}|${res.repository.name}>\n
      💫 배포 되었습니다!\n\n
      🙋🏻‍♀️ 배포 담당자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
      📅 배포일:  ${dayjs(res.deployment_status.created_at).format('YYYY-MM-DD HH:mm:ss')}\n
      📝 배포환경: ${res.deployment.environment}
    `

    sendSlackReplyMessage('💽 RP 입니다! PR 입니다요!', loadTableData.at(-1).thread_ts, createPrMessage, res.sender.avatar_url)

  }

// 배포 실패 되었을 때
  if (res.deployment_status?.state === 'failure') {
    const userNickname = await findUserName(res.sender.id, true)
    const userKoreanName = await findUserName(res.sender.id, false)

    const failureMessage = `
      <${res.deployment_status.target_url}|${res.repository.name}>\n
      🥲 안돼요.. 배포실패..\n\n
      🙋🏻‍♀️ 배포 담당자: @${userNickname} <${res.sender.html_url}|${userKoreanName}>\n
      📅 배포 실패일:  ${dayjs(res.deployment_status.created_at).format('YYYY-MM-DD HH:mm:ss')}\n
      📝 배포 실패환경: ${res.deployment.environment}
    `
    
    sendSlackReplyMessage('🥲 안돼요.. 배포실패..', loadTableData.at(-1).thread_ts, failureMessage, res.sender.avatar_url)

  }

  return new Response(
    JSON.stringify({ status: 'success done alarm' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

async function sendSlackReplyMessage(title:string, ts:string, text:string, image_url:string) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('FE_SLACK_BOT_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: Deno.env.get('FE_SLACK_CHANNEL_ID'),
        text: title,
        thread_ts: ts ?? '',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text
            },
            accessory: {
              type: 'image',
              image_url,
              alt_text: '아바타 이미지'
            }
          }
        ]
      })
    })

  return response.json()

  } catch (error) {
    console.error('Slack 전송중 오류 발생',error)
  }
}

function findUserName (id:number, nickname:boolean) {
  const result = githubFeTeamUser.find(user => user.id === id)
  if (!result) { return null }
  return nickname ? result.nickname : result.ko
}

// github FE팀 uuid
const githubFeTeamUser = [
  { id: 35613825, nickname: 'dewdew', ko: 'Vercel' },
  { id: 57179957, nickname: 'dewdew', ko: '듀듀' },
  { id: 61929050, nickname: 'now', ko: '나우' },
  { id: 83664915, nickname: 'charlie', ko: '찰리' }
]
