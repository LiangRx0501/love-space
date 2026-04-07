/**
 * Cloudflare Worker - AI 聊天 API 代理
 * 用于隐藏真实的 API Key，避免在前端暴露
 */

export default {
    async fetch(request, env) {
        // CORS 头部配置
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        };

        // 处理 OPTIONS 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // 只允许 POST 请求
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: corsHeaders
            });
        }

        try {
            // 获取前端发送的消息
            const { messages } = await request.json();

            if (!messages || !Array.isArray(messages)) {
                return new Response(JSON.stringify({
                    error: 'Invalid request',
                    message: 'messages must be an array'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // 调用智谱AI API
            const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.ZHIPU_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'glm-4-flash',
                    messages: messages,
                    stream: false,
                    temperature: 0.8,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                return new Response(JSON.stringify({
                    error: 'API Error',
                    status: response.status,
                    message: errorData
                }), {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            const data = await response.json();

            // 返回响应
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};
