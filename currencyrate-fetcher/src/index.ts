/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { fetchExchangerate } from "./handlers/currencyHandler";

//Defines worker attribute types
export interface Env {
	API_data: KVNamespace,
	SWOP_API_KEY: string,
	FREE_TIER_LIMITER: any
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "https://nobootloader.github.ioo",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
}

async function getCurrencyData(request: Request, env: Env): Promise<Response> {
	try {
		// Apply ratelimit
		const { pathname } = new URL(request.url)
		const { success } = await env.FREE_TIER_LIMITER.limit({ key: pathname })
		if (!success) {
			return new Response(`429 Failure - rate limit exceeded for ${pathname}`, {
					status: 429, 
					headers: {
					...corsHeaders,
					"Content-Type": "application/json"
				}
			})
		}
		// Get most recent data from KV Storage
		const exchangerates = await env.API_data.get("rates")

		if (exchangerates === null) {
			return new Response("Value not found", { 
				status: 404, 
				headers: {
					...corsHeaders,
					"Content-Type": "application/json"
				}
			})
		}
		return new Response(exchangerates, {
			status: 200,
			headers: {
				...corsHeaders,
				"Content-Type": "application/json" }
		})
	}
	catch (err) {
		console.error(`KV return error:`, err)
		const errorMsg =
			err instanceof Error
				? err.message
				: "An unknown error occurred when accessing KV storage"
		return new Response(errorMsg, {
			status: 500,
			headers: {
				...corsHeaders,
				"Content-Type": "application/json" }
		})
	}
}

export default {
	async fetch(request, env): Promise<Response> {


		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 200,
				headers: corsHeaders
			})
		}
		else if (request.method === "GET") {
			return getCurrencyData(request, env)
		} else {
			return new Response("Method not allowed", {
				status: 405,
				headers: corsHeaders
			})
		}
		
	},
	// Get most recent data from SWOP API and put to KV Storage
	async scheduled(controller, env) {
		const data = await fetchExchangerate(env.SWOP_API_KEY)
		const jsonData = JSON.stringify(data)
		await env.API_data.put("rates", jsonData)
	}
} satisfies ExportedHandler<Env>;




