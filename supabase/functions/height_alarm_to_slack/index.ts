// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import dayjs from 'https://cdn.skypack.dev/dayjs@1.11.10'

Deno.serve(async (_req) => {
  // -- reading
  const req = await _req.json()
  const { id, data, type } = req
  const { model, previousModel } = data

  console.log('received req ', req)

  // 작업 업데이트 시
  if (type === 'task.updated') {
    const alarmTemplateId = '0004434b-a3e7-44ec-addf-3963a39a8ce6'
    const alarmAllowId = '0677fc5a-d253-45e6-9d2f-54c1ce53ef4b'

    let prevAllowSlack = false
    let currAllowSlack = false

    previousModel.fields.forEach((field: any) => {
      if (field.fieldTemplateId === alarmTemplateId && field.value === alarmAllowId) {
        prevAllowSlack = true
      }
    })

    model.fields.forEach((field: any) => {
      if (field.fieldTemplateId === alarmTemplateId && field.value === alarmAllowId) {
        currAllowSlack = true
      }
    })

    if (!prevAllowSlack && currAllowSlack) {
      // Height created alarm to Slack
      console.log('slack create alarm allowed !!!!!!!!!')

      await heightAssignedAlarm(model.url, model.name, model.description, dayjs(model.createdAt).format('YYYY-MM-DD'), model.assigneesIds, model.createdUserId, true)

      return new Response(
        JSON.stringify({ status: 'success create alarm' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    } else if (prevAllowSlack && currAllowSlack && model.status === 'done') {
      // Height done alarm to Slack
      console.log('slack done alarm allowed !!!!!!!!!')

      await heightAssignedAlarm(model.url, model.name, model.description, dayjs(model.completedAt).format('YYYY-MM-DD'), model.assigneesIds, model.createdUserId, false)

      return new Response(
        JSON.stringify({ status: 'success done alarm' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return new Response(
    JSON.stringify({ status: 'ok' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

interface UserList {
  id: string
  nickname: string
  ko: string
}

// height 이용자 uuid
const heightUserList = [
  { id: '3a0d1d5d-2277-407a-973f-d1b591f29366', nickname: 'martin', ko: '마틴' },
  { id: '10b2e731-575d-41dc-ae48-53cafb58fccd', nickname: 'simon', ko: '사이먼' },
  { id: '583f6ba0-9624-4f1e-99b1-6a059518c3b3', nickname: 'max', ko: '맥스' },
  { id: '67b20720-ba74-49f9-bd62-603de72a2381', nickname: 'dewdew', ko: '듀듀' },
  { id: '5e747234-0c4e-49a8-9512-5015bc6494e3', nickname: 'now', ko: '나우' },
  { id: '5cd23962-efad-4bfc-bee3-de1aa3af8b4f', nickname: 'charlie', ko: '찰리' },
  { id: 'ce538711-f562-46b7-820f-e19f99954805', nickname: 'tuna', ko: '튜나' },
  { id: 'd1ed529c-a1b9-468d-bc8d-6d8ebb5ad791', nickname: 'bb', ko: '비비' },
  { id: '1b86c342-9620-42a1-985e-b86492730baa', nickname: 'gum', ko: '껌' },
  { id: '2987daf1-4f07-4401-8d20-bd0d71b186c9', nickname: 'woody', ko: '우디' },
  { id: '7c309c3d-9248-422c-82c3-8ced17a78c69', nickname: 'etham', ko: '에담' },
  { id: '5a5daaee-af54-4988-b2e0-504fbd45a5cd', nickname: 'summer', ko: '썸머' },
  { id: 'b6e7267b-8ab0-4059-bcc3-ee289b5d1484', nickname: 'damian', ko: '데미안' },
  { id: '70c321b2-f11b-4434-9e64-8806ef167606', nickname: 'chloe', ko: '클로이' },
  { id: '98aea79d-480a-4d34-ad92-110a69387333', nickname: 'hailee', ko: '헤일리' },
  { id: '6e48332b-68af-478e-91ce-0075f3903ad3', nickname: 'mapro', ko: '마프로' },
  { id: '0ce684d6-d551-42b3-be83-72205045a316', nickname: 'ellie', ko: '엘리' },
  { id: '83e07b8b-cb64-49f7-b4f5-bf385c1aaf0a', nickname: 'ireh', ko: '이레' },
  { id: 'd5de32aa-d1ea-4eda-ac81-a71bb74597fc', nickname: 'jay', ko: '제이' },
  { id: '23567aed-d7ad-4d07-87e9-583698f8bc1a', nickname: 'ryan', ko: '라이언' },
  { id: '3c1b5903-8711-4e01-90af-27a9e580ac2b', nickname: 'zoe', ko: '조이' },
  { id: '36806be3-e9c8-4b7c-ad0c-49d806e7a682', nickname: 'pio', ko: '피오' },
  { id: 'b11ee8e1-c38e-4827-8b37-07e419a02d1d', nickname: 'jerry', ko: '제리' },
  { id: 'd31435d2-6d60-4b07-96e8-1e06d60e324e', nickname: 'winnie', ko: '위니' },
  { id: '5db6e1f1-b2bd-4548-b79b-55e8ec533498', nickname: 'jocelyn', ko: '조셀린' }
]

function searchCreateUser (userId:string) {
  return heightUserList.filter(user => user.id === userId)[0]
}

function searchAssignedUser (userIds:string[]) {
  return heightUserList.filter(user => userIds.some(id => id === user.id)).map((user:UserList) => `@${user.nickname} (${user.ko})`).join(' / ').trim()
}

async function heightAssignedAlarm (url:string, title:string, description:string, date:string, assigneesIds:string[], createdUserId:string, createdIssueTrigger:boolean) {
  const slackRes = await fetch('https://hooks.slack.com/services/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', {
    method: 'POST',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: createdIssueTrigger ? 'Height에서 Task가 생성되었어요!!' : 'Height에서 Task가 완료 되었어요!!',
            emoji: true
          }
        },
        {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                {
                  type: 'text',
                  text: `Task 제목: ${title}`,
                  style: {
                    bold: true
                  }
                }
              ]
            }
          ]
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Height Task를 확인하러 가보시죠!'
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':carousel_horse: Height Task 열기',
              emoji: true
            },
            value: 'click_me_123',
            url: `${url}`,
            action_id: 'button-action'
          }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: createdIssueTrigger
              ? `:sleuth_or_spy: 생성자: @${searchCreateUser(createdUserId).nickname}`
              : `:sleuth_or_spy: 생성자: @${searchCreateUser(createdUserId).nickname}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: createdIssueTrigger
              ? `:astronaut: 담당자: ${searchAssignedUser(assigneesIds)}`
              : `:astronaut: 담당자: ${searchAssignedUser(assigneesIds)}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: createdIssueTrigger ? `:calendar: 작업 생성일: ${date}` : `:calendar: 작업 종료일: ${date}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: createdIssueTrigger
              ? `:microphone: 내용: \n ${description}`
              : '이번 업무는 잘 진행 되셨길 바래요!'
          }
        },
        { type: 'divider' },
        {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                {
                  type: 'text',
                  text: createdIssueTrigger ? '담당자 분은 작업 처리해주세요! 삐삑!' : '정말 고생 많으셨습니다!',
                  style: {
                    bold: true
                  }
                }
              ]
            }
          ]
        },
        { type: 'divider' }
      ]
    })
  })

  console.log('slack response', slackRes)
}
