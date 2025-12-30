-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "profilePictureUrl" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'email',
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "couchManagerRoomId" TEXT,
    "numTeams" INTEGER NOT NULL,
    "budgetPerTeam" INTEGER NOT NULL,
    "scoringType" TEXT NOT NULL,
    "projectionSystem" TEXT NOT NULL,
    "leagueType" TEXT NOT NULL DEFAULT 'redraft',
    "rosterSpots" JSONB NOT NULL,
    "hittingCategories" JSONB,
    "pitchingCategories" JSONB,
    "dynastySettings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'setup',
    "draftStartedAt" TIMESTAMP(3),
    "draftCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_leagues" (
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "teamName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_leagues_pkey" PRIMARY KEY ("userId","leagueId")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "mlbamId" INTEGER,
    "name" TEXT NOT NULL,
    "team" TEXT,
    "positions" TEXT[],
    "playerType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_projections" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "projectionSystem" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_players" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "projectedValue" DOUBLE PRECISION,
    "adjustedValue" DOUBLE PRECISION,
    "tier" INTEGER,
    "draftedPrice" INTEGER,
    "draftedBy" TEXT,
    "draftedAt" TIMESTAMP(3),
    "currentBid" INTEGER,
    "currentBidder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_picks" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "draftedByUserId" TEXT NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "inflationRateAtPick" DOUBLE PRECISION,
    "draftedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "leagues_ownerId_idx" ON "leagues"("ownerId");

-- CreateIndex
CREATE INDEX "leagues_status_idx" ON "leagues"("status");

-- CreateIndex
CREATE INDEX "leagues_couchManagerRoomId_idx" ON "leagues"("couchManagerRoomId");

-- CreateIndex
CREATE INDEX "user_leagues_userId_idx" ON "user_leagues"("userId");

-- CreateIndex
CREATE INDEX "user_leagues_leagueId_idx" ON "user_leagues"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "players_externalId_key" ON "players"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "players_mlbamId_key" ON "players"("mlbamId");

-- CreateIndex
CREATE INDEX "players_externalId_idx" ON "players"("externalId");

-- CreateIndex
CREATE INDEX "players_mlbamId_idx" ON "players"("mlbamId");

-- CreateIndex
CREATE INDEX "players_name_idx" ON "players"("name");

-- CreateIndex
CREATE INDEX "players_team_idx" ON "players"("team");

-- CreateIndex
CREATE INDEX "player_projections_playerId_idx" ON "player_projections"("playerId");

-- CreateIndex
CREATE INDEX "player_projections_projectionSystem_idx" ON "player_projections"("projectionSystem");

-- CreateIndex
CREATE INDEX "player_projections_season_idx" ON "player_projections"("season");

-- CreateIndex
CREATE UNIQUE INDEX "player_projections_playerId_projectionSystem_season_key" ON "player_projections"("playerId", "projectionSystem", "season");

-- CreateIndex
CREATE INDEX "league_players_leagueId_status_idx" ON "league_players"("leagueId", "status");

-- CreateIndex
CREATE INDEX "league_players_playerId_idx" ON "league_players"("playerId");

-- CreateIndex
CREATE INDEX "league_players_tier_idx" ON "league_players"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "league_players_leagueId_playerId_key" ON "league_players"("leagueId", "playerId");

-- CreateIndex
CREATE INDEX "draft_picks_leagueId_idx" ON "draft_picks"("leagueId");

-- CreateIndex
CREATE INDEX "draft_picks_playerId_idx" ON "draft_picks"("playerId");

-- CreateIndex
CREATE INDEX "draft_picks_draftedByUserId_idx" ON "draft_picks"("draftedByUserId");

-- CreateIndex
CREATE INDEX "draft_picks_draftedAt_idx" ON "draft_picks"("draftedAt");

-- CreateIndex
CREATE UNIQUE INDEX "draft_picks_leagueId_pickNumber_key" ON "draft_picks"("leagueId", "pickNumber");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_leagues" ADD CONSTRAINT "user_leagues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_leagues" ADD CONSTRAINT "user_leagues_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_projections" ADD CONSTRAINT "player_projections_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_players" ADD CONSTRAINT "league_players_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_players" ADD CONSTRAINT "league_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draftedByUserId_fkey" FOREIGN KEY ("draftedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
