using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChitChat.Data;
using ChitChat.DTOs;

namespace ChitChat.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessagesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MessagesController> _logger;

        public MessagesController(ApplicationDbContext context, ILogger<MessagesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/messages/conversation?userId1=1&userId2=2
        [HttpGet("conversation")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetConversation(
            [FromQuery] int userId1, 
            [FromQuery] int userId2)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => 
                        (m.SenderId == userId1 && m.ReceiverId == userId2) ||
                        (m.SenderId == userId2 && m.ReceiverId == userId1))
                    .OrderBy(m => m.SentAt)
                    .Select(m => new MessageDto
                    {
                        Id = m.Id,
                        SenderId = m.SenderId,
                        ReceiverId = m.ReceiverId,
                        Content = m.Content,
                        SentAt = m.SentAt,
                        IsRead = m.IsRead
                    })
                    .ToListAsync();

                return Ok(messages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching conversation");
                return StatusCode(500, "Error fetching conversation");
            }
        }

        // GET: api/messages/user/1
        [HttpGet("user/{userId}")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetUserMessages(int userId)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.SenderId == userId || m.ReceiverId == userId)
                    .OrderByDescending(m => m.SentAt)
                    .Select(m => new MessageDto
                    {
                        Id = m.Id,
                        SenderId = m.SenderId,
                        ReceiverId = m.ReceiverId,
                        Content = m.Content,
                        SentAt = m.SentAt,
                        IsRead = m.IsRead
                    })
                    .ToListAsync();

                return Ok(messages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user messages");
                return StatusCode(500, "Error fetching user messages");
            }
        }

        // GET: api/messages/unread/1
        [HttpGet("unread/{userId}")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetUnreadMessages(int userId)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.ReceiverId == userId && !m.IsRead)
                    .OrderBy(m => m.SentAt)
                    .Select(m => new MessageDto
                    {
                        Id = m.Id,
                        SenderId = m.SenderId,
                        ReceiverId = m.ReceiverId,
                        Content = m.Content,
                        SentAt = m.SentAt,
                        IsRead = m.IsRead
                    })
                    .ToListAsync();

                return Ok(messages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching unread messages");
                return StatusCode(500, "Error fetching unread messages");
            }
        }
    }
}
