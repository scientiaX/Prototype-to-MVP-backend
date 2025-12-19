/**
 * WebSocket Service for Real-time Arena Communication
 * 
 * Handles:
 * - Real-time keystroke tracking
 * - AI intervention messages (warnings, questions)
 * - Session state updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import SessionMemory from '../models/SessionMemory.js';
import * as orchestrator from './orchestratorService.js';

// Store active connections: Map<sessionId, WebSocket>
const activeConnections = new Map();

/**
 * Initialize WebSocket server
 */
export const initWebSocketServer = (server) => {
    const wss = new WebSocketServer({
        server,
        path: '/ws/arena'
    });

    wss.on('connection', (ws, req) => {
        console.log('WebSocket client connected');

        let sessionId = null;

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                switch (message.type) {
                    case 'join_session':
                        sessionId = message.session_id;
                        activeConnections.set(sessionId, ws);
                        ws.send(JSON.stringify({
                            type: 'session_joined',
                            session_id: sessionId
                        }));
                        console.log(`Session ${sessionId} joined via WebSocket`);
                        break;

                    case 'keystroke':
                        if (sessionId) {
                            await orchestrator.processUserKeystrokes(sessionId, message.data);
                            // Check if intervention needed
                            const action = await orchestrator.requestNextAction(sessionId);
                            if (action.action !== 'none') {
                                ws.send(JSON.stringify({
                                    type: 'ai_action',
                                    action: action
                                }));
                            }
                        }
                        break;

                    case 'user_response':
                        if (sessionId) {
                            // User submitted a response - process and get next AI action
                            const result = await orchestrator.processUserResponse(
                                sessionId,
                                message.response,
                                message.time_elapsed
                            );

                            ws.send(JSON.stringify({
                                type: 'response_processed',
                                ...result
                            }));
                        }
                        break;

                    case 'intervention_response':
                        if (sessionId) {
                            const result = await orchestrator.handleInterventionResponse(
                                sessionId,
                                message.response_type
                            );
                            ws.send(JSON.stringify({
                                type: 'intervention_result',
                                ...result
                            }));
                        }
                        break;

                    case 'request_hint':
                        if (sessionId) {
                            // User is asking for help
                            const memory = await SessionMemory.findOne({ session_id: sessionId });
                            if (memory) {
                                const aiSimple = await import('./aiSimpleService.js');
                                const hint = await aiSimple.generateHint(
                                    memory.problem_snapshot,
                                    memory.user_profile_snapshot,
                                    message.partial_answer || ''
                                );
                                ws.send(JSON.stringify({
                                    type: 'hint',
                                    message: hint
                                }));
                            }
                        }
                        break;

                    case 'ping':
                        ws.send(JSON.stringify({ type: 'pong' }));
                        break;
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: error.message
                }));
            }
        });

        ws.on('close', () => {
            if (sessionId) {
                activeConnections.delete(sessionId);
                console.log(`Session ${sessionId} disconnected`);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('WebSocket server initialized on /ws/arena');
    return wss;
};

/**
 * Send message to specific session
 */
export const sendToSession = (sessionId, message) => {
    const ws = activeConnections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    return false;
};

/**
 * Broadcast AI intervention to session
 */
export const sendIntervention = (sessionId, interventionType, message, options = {}) => {
    return sendToSession(sessionId, {
        type: 'intervention',
        intervention_type: interventionType,
        message,
        ...options
    });
};

/**
 * Send new question to session
 */
export const sendNewQuestion = (sessionId, question, questionType = 'follow_up') => {
    return sendToSession(sessionId, {
        type: 'new_question',
        question,
        question_type: questionType
    });
};

/**
 * Send session conclusion
 */
export const sendConclusion = (sessionId, evaluationData) => {
    return sendToSession(sessionId, {
        type: 'session_complete',
        ...evaluationData
    });
};

export default {
    initWebSocketServer,
    sendToSession,
    sendIntervention,
    sendNewQuestion,
    sendConclusion
};
