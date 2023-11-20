// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  // -- reading
  const req = await _req.json()
  const { id, data, type } = req
  const { model, previousModel } = data

  console.log('received req ', req)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  // 작업 업데이트 시
  if (type === 'task.updated') {

    // FE 이슈가 아닐 경우
    if (!isFEIssue(model)) {
      if (!model.fields.length) {
        return new Response(
          JSON.stringify({ status: 'no have fields' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else {
      console.log('task updated')

      const { data: height_github, error } = await supabase
        .from('height_github')
        .select('*')
        .eq('height_uid', model.id)

      const { github_id: githubId, repo } = height_github?.[0]

      console.log('github id :', githubId, repo)
      
      if (error) {
        console.log('error', error)
        return new Response(
          JSON.stringify({ status: 'error' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (!height_github?.length) {
        console.log('not found height github')
        return new Response(
          JSON.stringify({ status: 'not found height github' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (!githubId) {
        return new Response(
          JSON.stringify({ status: 'not found github id' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 내용 변경 시
      if (previousModel && previousModel.description !== model.description) {
        console.log('description changed')

        // -- processing
        const res = await fetch(`${Deno.env.get('GITHUB_BASE_URL')}/repos/usimsa/${repo}/issues/${githubId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/vnd.github+json',
            Authorization: `Bearer ${Deno.env.get('GITHUB_AUTH_TOKEN')}`,
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            title: getTitle(model),
            body: model.description,
            labels: []
          })
        }).then(res => res.json())

        console.log('res from github', res)
        // done
      }

      if (previousModel && model.fields?.length) {
        // 라벨 변경 시
        console.log('fields changed')

        const labels = [] as any
        model.fields.forEach((field: any) => {
          if (!field.labels) return
          field.labels.forEach((label: any) => {
            labels.push(label.value)
          })
        })

        const res = await fetch(`${Deno.env.get('GITHUB_BASE_URL')}/repos/usimsa/${repo}/issues/${githubId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/vnd.github+json',
            Authorization: `Bearer ${Deno.env.get('GITHUB_AUTH_TOKEN')}`,
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            title: getTitle(model),
            body: model.description,
            labels
          })
        }).then(res => res.json())

        console.log('res from github', res)
      }
    }
  }

  return new Response(
    JSON.stringify({ status: 'ok' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

function isFEIssue (model: any) {
  return model.name.includes('FE-')
}

// ex) [BUG] T-2584/-usimsa-com-fe-bug-026
function getTitle (model: any) {
  const name = model.name.split('FE-')[1]
  const tag = name.split('-')[0]
  const ticket = `T-${model.index}`

  return `[${tag}] ${ticket}/${name}`
}
