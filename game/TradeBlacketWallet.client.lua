-- TradeBlacket wallet panel.
--
-- The in-game half of moving Rodux to and from the TradeBlacket website. Everything that matters
-- happens on the server in Players.SiteWallet; this only draws the panel and calls its three
-- remotes: GetSiteWallet (read), SiteDeposit (send Rodux to the site) and SiteWithdraw (ask for
-- Rodux back). Built in code so it adds one ScreenGui and changes nothing that already exists.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local GetSiteWallet = Remotes:WaitForChild("GetSiteWallet") :: RemoteFunction
local SiteDeposit = Remotes:WaitForChild("SiteDeposit") :: RemoteFunction
local SiteWithdraw = Remotes:WaitForChild("SiteWithdraw") :: RemoteFunction
local SiteWalletUpdated = Remotes:WaitForChild("SiteWalletUpdated") :: RemoteEvent

local SITE_NAME = "TradeBlacket"

local C = {
	bg = Color3.fromRGB(15, 25, 35),
	panel = Color3.fromRGB(21, 33, 44),
	raise = Color3.fromRGB(35, 53, 69),
	line = Color3.fromRGB(43, 65, 83),
	text = Color3.fromRGB(231, 238, 245),
	muted = Color3.fromRGB(145, 164, 182),
	green = Color3.fromRGB(31, 203, 107),
	greenInk = Color3.fromRGB(3, 32, 14),
	red = Color3.fromRGB(240, 77, 94),
	gold = Color3.fromRGB(242, 179, 61),
}
local FONT = Enum.Font.GothamMedium
local BOLD = Enum.Font.GothamBold

local function make(class: string, props: {[string]: any}, children: {Instance}?): Instance
	local inst = Instance.new(class)
	for k, v in props do
		(inst :: any)[k] = v
	end
	for _, child in children or {} do
		child.Parent = inst
	end
	return inst
end
local function corner(r: number) return make("UICorner", { CornerRadius = UDim.new(0, r) }) end
local function stroke(c: Color3) return make("UIStroke", { Color = c, Thickness = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }) end
local function pad(p: number) return make("UIPadding", { PaddingTop = UDim.new(0, p), PaddingBottom = UDim.new(0, p), PaddingLeft = UDim.new(0, p), PaddingRight = UDim.new(0, p) }) end

local function fmt(n: number): string
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (out:gsub("^,", ""))
end

local gui = make("ScreenGui", { Name = "TradeBlacketWalletPanel", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 20 })

-- Launcher, bottom left, out of the way of the existing interface.
local launcher = make("TextButton", {
	Name = "Launcher", AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 16, 1, -16), Size = UDim2.fromOffset(150, 40),
	BackgroundColor3 = C.green, Text = SITE_NAME, TextColor3 = C.greenInk, Font = BOLD, TextSize = 15, AutoButtonColor = true,
}, { corner(8) })
launcher.Parent = gui

local panel = make("Frame", {
	Name = "Panel", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(380, 440),
	BackgroundColor3 = C.panel, Visible = false,
}, { corner(12), stroke(C.line), pad(18) })
panel.Parent = gui

local list = make("UIListLayout", { Padding = UDim.new(0, 10), SortOrder = Enum.SortOrder.LayoutOrder })
list.Parent = panel

local header = make("Frame", { LayoutOrder = 1, Size = UDim2.new(1, 0, 0, 28), BackgroundTransparency = 1 })
header.Parent = panel
make("TextLabel", { Size = UDim2.new(1, -36, 1, 0), BackgroundTransparency = 1, Text = SITE_NAME .. " wallet", TextColor3 = C.text, Font = BOLD, TextSize = 19, TextXAlignment = Enum.TextXAlignment.Left }).Parent = header
local close = make("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 0, 0, 0), Size = UDim2.fromOffset(28, 28), BackgroundColor3 = C.raise, Text = "×", TextColor3 = C.muted, Font = BOLD, TextSize = 20 }, { corner(6) })
close.Parent = header

make("TextLabel", { LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 34), BackgroundTransparency = 1, TextWrapped = true, Text = "Send Rodux to the website to play there, and bring it back here whenever you like.", TextColor3 = C.muted, Font = FONT, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top }).Parent = panel

local stats = make("Frame", { LayoutOrder = 3, Size = UDim2.new(1, 0, 0, 108), BackgroundTransparency = 1 }, {
	make("UIGridLayout", { CellSize = UDim2.new(0.5, -5, 0, 49), CellPadding = UDim2.fromOffset(10, 10) }),
})
stats.Parent = panel
local function stat(name: string, label: string)
	local f = make("Frame", { Name = name, BackgroundColor3 = C.bg }, { corner(8), pad(8) })
	make("TextLabel", { Name = "L", Size = UDim2.new(1, 0, 0, 14), BackgroundTransparency = 1, Text = label, TextColor3 = C.muted, Font = FONT, TextSize = 12, TextXAlignment = Enum.TextXAlignment.Left }).Parent = f
	make("TextLabel", { Name = "V", Position = UDim2.fromOffset(0, 16), Size = UDim2.new(1, 0, 0, 18), BackgroundTransparency = 1, Text = "–", TextColor3 = C.text, Font = BOLD, TextSize = 16, TextXAlignment = Enum.TextXAlignment.Left }).Parent = f
	f.Parent = stats
	return f:FindFirstChild("V") :: TextLabel
end
local vOnSite = stat("OnSite", "On " .. SITE_NAME)
local vBack = stat("Withdrawable", "Can bring back")
local vOut = stat("Sending", "Sending")
local vIn = stat("Returning", "Coming back")

local amount = make("TextBox", {
	LayoutOrder = 4, Size = UDim2.new(1, 0, 0, 42), BackgroundColor3 = C.bg, PlaceholderText = "Amount of Rodux", PlaceholderColor3 = C.muted,
	Text = "", TextColor3 = C.text, Font = BOLD, TextSize = 16, ClearTextOnFocus = false,
}, { corner(8), stroke(C.line), make("UIPadding", { PaddingLeft = UDim.new(0, 12) }) })
amount.TextXAlignment = Enum.TextXAlignment.Left
amount.Parent = panel

local buttons = make("Frame", { LayoutOrder = 5, Size = UDim2.new(1, 0, 0, 42), BackgroundTransparency = 1 }, {
	make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 10) }),
})
buttons.Parent = panel
local sendBtn = make("TextButton", { Size = UDim2.new(0.5, -5, 1, 0), BackgroundColor3 = C.green, Text = "Send to " .. SITE_NAME, TextColor3 = C.greenInk, Font = BOLD, TextSize = 14 }, { corner(8) })
sendBtn.Parent = buttons
local backBtn = make("TextButton", { Size = UDim2.new(0.5, -5, 1, 0), BackgroundColor3 = C.raise, Text = "Bring back", TextColor3 = C.text, Font = BOLD, TextSize = 14 }, { corner(8) })
backBtn.Parent = buttons

local message = make("TextLabel", { LayoutOrder = 6, Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1, TextWrapped = true, Text = "", TextColor3 = C.muted, Font = FONT, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top })
message.Parent = panel

make("TextLabel", { LayoutOrder = 7, Size = UDim2.new(1, 0, 0, 52), BackgroundTransparency = 1, TextWrapped = true, Text = "Transfers finish once the website confirms them, usually within seconds. You can only bring back as much Rodux as you have sent.", TextColor3 = C.muted, Font = FONT, TextSize = 11, TextTransparency = 0.25, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top }).Parent = panel

gui.Parent = player:WaitForChild("PlayerGui")

local busy = false
local function say(text: string, color: Color3?)
	message.Text = text
	message.TextColor3 = color or C.muted
end

local function draw(wallet: any)
	if typeof(wallet) ~= "table" then
		return
	end
	vOnSite.Text = fmt(wallet.onSite or 0)
	vBack.Text = fmt(wallet.withdrawable or 0)
	vOut.Text = fmt(wallet.depositing or 0)
	vIn.Text = fmt(wallet.withdrawing or 0)
	local on = wallet.enabled == true
	sendBtn.AutoButtonColor = on
	sendBtn.BackgroundTransparency = if on then 0 else 0.5
	local backOn = wallet.withdrawalsEnabled == true
	backBtn.BackgroundTransparency = if backOn then 0 else 0.5
	if not on then
		say("Transfers to " .. SITE_NAME .. " aren't switched on yet.")
	end
end

local function refresh()
	local ok, wallet = pcall(function()
		return GetSiteWallet:InvokeServer()
	end)
	if ok then
		draw(wallet)
	end
end

local function act(remote: RemoteFunction)
	if busy then
		return
	end
	local n = tonumber(amount.Text)
	if not n or n < 1 or n % 1 ~= 0 then
		say("Enter a whole amount of Rodux.", C.red)
		return
	end
	busy = true
	say("Working on it…")
	local ok, result = pcall(function()
		return remote:InvokeServer(n)
	end)
	busy = false
	if not ok or typeof(result) ~= "table" then
		say("Something went wrong. Try again in a moment.", C.red)
		return
	end
	say(result.message or "", if result.success then C.green else C.red)
	if result.success then
		amount.Text = ""
	end
	if result.wallet then
		draw(result.wallet)
	end
end

local function open(visible: boolean)
	panel.Visible = visible
	if visible then
		panel.Size = UDim2.fromOffset(380, 420)
		TweenService:Create(panel, TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = UDim2.fromOffset(380, 440) }):Play()
		refresh()
	end
end

launcher.MouseButton1Click:Connect(function() open(not panel.Visible) end)
close.MouseButton1Click:Connect(function() open(false) end)
sendBtn.MouseButton1Click:Connect(function() act(SiteDeposit) end)
backBtn.MouseButton1Click:Connect(function() act(SiteWithdraw) end)

SiteWalletUpdated.OnClientEvent:Connect(function(payload: any)
	if typeof(payload) ~= "table" then
		return
	end
	draw(payload.wallet)
	local s = payload.settled
	if typeof(s) == "table" then
		if s.kind == "deposit" then
			say(if s.outcome == "ok" then string.format("%s Rodux arrived on %s.", fmt(s.amount), SITE_NAME)
				else string.format("%s didn't accept that deposit, so %s Rodux came back.", SITE_NAME, fmt(s.amount)),
				if s.outcome == "ok" then C.green else C.gold)
		elseif s.kind == "withdraw" and s.outcome == "ok" then
			say(string.format("%s Rodux is back in your balance.", fmt(s.amount)), C.green)
		elseif s.kind == "withdraw" then
			say(s.reason or (SITE_NAME .. " couldn't return that Rodux."), C.gold)
		end
	end
end)
