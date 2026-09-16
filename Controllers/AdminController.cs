using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers
{
    public class AdminController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
