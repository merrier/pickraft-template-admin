import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App, Button, Card, Form, Input, Layout, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ProConfigProvider, ProLayout } from '@ant-design/pro-components'
import { SearchOutlined, LogoutOutlined, StarFilled, WarningOutlined, MessageOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons'
import 'antd/dist/reset.css'
import './styles.css'

const API = window.PICKRAFT_API_ORIGIN || 'https://api.merrier.wang'
const TAG_NAMES = { minimal:'极简', realistic:'写实', cinematic:'电影感', film:'胶片', vintage:'复古', illustration:'插画', portrait:'人像', anime:'动漫', fashion:'时尚', travel:'旅行', pet:'宠物', wedding:'婚礼' }
const tagName = value => TAG_NAMES[String(value).toLowerCase()] || value
const esc = value => String(value ?? '')

async function api(path, options = {}, token) {
  const response = await fetch(API + path, { ...options, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || '请求失败')
  return body
}

function Login({ onLogin }) {
  const [form] = Form.useForm(); const [busy, setBusy] = useState(false)
  return <div className="login-page"><Card className="login-card"><div className="logo">P</div><Typography.Text type="secondary">PICKRAFT / OPS</Typography.Text><Typography.Title level={1}>模板运营台</Typography.Title><Typography.Paragraph type="secondary">管理模板上架状态、精选与推荐策略。</Typography.Paragraph><Form form={form} layout="vertical" onFinish={async values => { setBusy(true); try { const result = await api('/admin/portal/login', { method:'POST', body:JSON.stringify(values) }); onLogin(result.token) } catch (error) { message.error(error.message) } finally { setBusy(false) } }}><Form.Item name="username" label="账号" rules={[{required:true}]}><Input autoComplete="username" /></Form.Item><Form.Item name="password" label="密码" rules={[{required:true}]}><Input.Password autoComplete="current-password" /></Form.Item><Button type="primary" htmlType="submit" block loading={busy}>进入运营台</Button></Form></Card></div>
}

function Portal({ token, logout }) {
  const [rows, setRows] = useState([]), [categories, setCategories] = useState([]), [loading, setLoading] = useState(false), [feedback, setFeedback] = useState(null), [feedbackText, setFeedbackText] = useState(''), [feedbackBusy, setFeedbackBusy] = useState(false)
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20), [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ listed:'true', featured:'all', recommended:'all', category:'all', sort:'updated-desc' })
  const load = async (next={}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({q:search, listed:filters.listed, featured:filters.featured, recommended:filters.recommended, sort:filters.sort, cursor:String(((next.page ?? page)-1)*(next.pageSize ?? pageSize)), limit:String(next.pageSize ?? pageSize), ...(filters.category !== 'all' ? {category:filters.category} : {})})
      const [result, taxonomy] = await Promise.all([api(`/admin/portal/templates?${params}`, {}, token), api('/taxonomy', {}, token)])
      setRows(result.items); setTotal(result.total); setCategories(taxonomy.categories)
    } catch (error) { if (/登录|授权|401|403/.test(error.message)) logout(); else message.error(error.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [page, pageSize, filters])
  const changeFilter = (key, value) => { setPage(1); setFilters(current => ({...current, [key]:value})) }
  const searchNow = () => { setPage(1); load({page:1}) }
  const clearFilters = () => { setSearch(''); setPage(1); setFilters({listed:'true', featured:'all', recommended:'all', category:'all', sort:'updated-desc'}) }
  const update = async (row, type, value) => { try { const path = type === 'featured' ? `/admin/templates/${row.id}/featured` : `/admin/templates/${row.id}/recommendation`; const body = type === 'featured' ? {active:value, confirmConflict:true} : {excluded:!value, confirmConflict:true}; await api(path, {method:'POST', body:JSON.stringify(body)}, token); message.success('状态已更新'); load() } catch (error) { message.error(error.message) } }
  const unlist = async (row, reasonCode) => { try { await api(`/admin/templates/${row.id}/listing`, {method:'POST', body:JSON.stringify({listed:false, reasonCode, reason: reasonCode === 'sexual' ? '色情内容' : '无亮点'})}, token); message.success('模板已下架'); load() } catch (error) { message.error(error.message) } }
  const showFeedback = async row => { try { const data = await api(`/templates/${row.id}/feedback`, {}, token); setFeedback({row, data}); setFeedbackText('') } catch (error) { message.error(error.message) } }
  const copyId = async row => { try { await navigator.clipboard.writeText(row.id); message.success('模板 ID 已复制') } catch { message.error('复制失败，请手动复制') } }
  const submitFeedback = async () => { const text=feedbackText.trim(); if(!text)return message.warning('请输入反馈内容'); setFeedbackBusy(true); try { await api(`/templates/${feedback.row.id}/feedback`, {method:'POST', body:JSON.stringify({message:text, idempotencyKey:crypto.randomUUID()})}, token); message.success('反馈已提交'); setFeedbackText(''); const data=await api(`/templates/${feedback.row.id}/feedback`, {}, token); setFeedback({...feedback,data}) } catch(error) { message.error(error.message) } finally { setFeedbackBusy(false) } }
  const image = (url, alt) => url ? <img className="table-image" src={url} alt={alt} /> : <span className="no-image">暂无</span>
  const columns = [
    {title:'模板', fixed:'left', width:330, render:(_, row) => <Space><div><Typography.Text strong>{row.name}</Typography.Text><Space size={2} className="id"><Typography.Text type="secondary">ID: {row.shortId || row.id}</Typography.Text><Button type="text" size="small" icon={<CopyOutlined />} aria-label="复制模板 ID" title="复制完整模板 ID" onClick={() => copyId(row)} /></Space></div></Space>},
    {title:'输入参考图', width:130, render:(_, row) => image(row.examples?.[0]?.inputs?.[0]?.previewUrl, '输入参考图')},
    {title:'输出示例图', width:130, render:(_, row) => image(row.cover, '输出示例图')},
    {title:'分类', dataIndex:'categoryName', width:110},
    {title:'标签', width:220, render:(_, row) => <Space wrap>{(row.tags || []).slice(0,5).map(tag => <Tag key={tag}>{tagName(tag)}</Tag>)}</Space>},
    {title:'上架状态', width:110, render:(_, row) => row.listed ? <Tag color="green">上架中</Tag> : <Tag>已下架</Tag>},
    {title:'精选', width:90, render:(_, row) => row.featured ? <Tag color="gold" icon={<StarFilled />}>精选</Tag> : <Tag>普通</Tag>},
    {title:'推荐', width:100, render:(_, row) => row.excluded ? <Tag color="red">不推荐</Tag> : <Tag color="green">推荐</Tag>},
    {title:'操作', fixed:'right', width:470, render:(_, row) => <Space wrap><Button size="small" icon={<StarFilled />} onClick={() => update(row, 'featured', !row.featured)}>{row.featured ? '取消精选' : '精选'}</Button><Button size="small" danger={row.excluded} onClick={() => update(row, 'recommended', !row.excluded)}>{row.excluded ? '恢复推荐' : '不推荐'}</Button><Button size="small" icon={<MessageOutlined />} onClick={() => showFeedback(row)}>反馈</Button><Button size="small" danger icon={<StopOutlined />} disabled={!row.listed} onClick={() => unlist(row, 'unremarkable')}>下架（无亮点）</Button><Button size="small" danger icon={<StopOutlined />} disabled={!row.listed} onClick={() => unlist(row, 'sexual')}>下架（色情）</Button></Space>}
  ]
  return <ProConfigProvider><ProLayout title="拾作模板运营台" logo={<div className="mini-logo">P</div>} layout="top" fixSiderbar={false} token={{header:{colorBgHeader:'#fff'}, pageContainer:{paddingInlinePage:24}}} actionsRender={() => <Button type="text" icon={<LogoutOutlined />} onClick={logout}>退出</Button>}><Card bordered={false}><Space direction="vertical" size="large" style={{width:'100%'}}><Space wrap><Input allowClear prefix={<SearchOutlined />} placeholder="搜索模板名称或 ID" value={search} onChange={event => setSearch(event.target.value)} onPressEnter={searchNow} style={{width:260}} /><Button type="primary" onClick={searchNow}>搜索</Button><Select value={filters.sort} onChange={value => changeFilter('sort',value)} options={[['updated-desc','排序：最近更新'],['created-desc','最近上架'],['created-asc','最早上架'],['name-asc','名称 A-Z'],['name-desc','名称 Z-A'],['featured','精选优先'],['excluded','不推荐优先'],['listed','上架中优先']].map(([value,label]) => ({value,label}))} /><Select value={filters.listed} onChange={value => changeFilter('listed',value)} options={[['all','上架状态：全部'],['true','上架中'],['false','已下架']].map(([value,label]) => ({value,label}))} /><Select value={filters.featured} onChange={value => changeFilter('featured',value)} options={[['all','精选：全部'],['true','已精选'],['false','未精选']].map(([value,label]) => ({value,label}))} /><Select value={filters.recommended} onChange={value => changeFilter('recommended',value)} options={[['all','推荐：全部'],['true','推荐'],['false','不推荐']].map(([value,label]) => ({value,label}))} /><Select value={filters.category} onChange={value => changeFilter('category',value)} options={[{value:'all',label:'分类：全部'}, ...categories.map(category => ({value:category.id,label:category.name}))]} /><Button onClick={clearFilters}>清空筛选</Button></Space><Typography.Text type="secondary">共 {total} 个模板</Typography.Text><Table rowKey="id" loading={loading} columns={columns} dataSource={rows} scroll={{x:1600}} pagination={{current:page,pageSize,total,showSizeChanger:true,showTotal:value => `共 ${value} 条`,onChange:(nextPage,nextPageSize) => {setPage(nextPage);if(nextPageSize !== pageSize){setPageSize(nextPageSize);setPage(1)}}}} /></Space></Card></ProLayout><Modal open={!!feedback} title={feedback ? `模板反馈 · ${feedback.row.name}` : ''} okText="提交反馈" confirmLoading={feedbackBusy} onOk={submitFeedback} onCancel={() => setFeedback(null)}>{feedback?.data?.length ? feedback.data.map(item => <Card size="small" key={`${item.createdAt}-${item.message}`} style={{marginBottom:8}}><Typography.Paragraph>{item.message}</Typography.Paragraph><Typography.Text type="secondary">{new Date(item.createdAt).toLocaleString('zh-CN')}</Typography.Text></Card>) : <Typography.Text type="secondary">暂无反馈</Typography.Text>}<Input.TextArea value={feedbackText} onChange={event => setFeedbackText(event.target.value)} placeholder="请输入需要反馈的问题" rows={4} maxLength={2000} showCount style={{marginTop:16}} /></Modal></ProConfigProvider>
}
function AppRoot() { const [token, setToken] = useState(sessionStorage.getItem('pickraft_admin_token') || ''); const logout = () => { sessionStorage.removeItem('pickraft_admin_token'); setToken('') }; return token ? <Portal token={token} logout={logout} /> : <Login onLogin={value => {sessionStorage.setItem('pickraft_admin_token', value); setToken(value)}} /> }
createRoot(document.getElementById('root')).render(<App><AppRoot /></App>)
