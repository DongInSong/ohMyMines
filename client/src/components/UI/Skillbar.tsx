import { useState, useEffect, useCallback } from 'react';
import type { SkillType } from 'shared';
import { SKILL_LIST } from 'shared';
import { useGame } from '../../hooks/useGame';
import { usePlayerStore } from '../../stores/playerStore';

export function Skillbar() {
  const { handleUseSkill } = useGame();
  const player = usePlayerStore((s) => s.player);
  const activeSkills = usePlayerStore((s) => s.activeSkills);
  const [cooldowns, setCooldowns] = useState<Record<SkillType, number>>({
    scan: 0,
    shield: 0,
    chain: 0,
    vision: 0,
    mark: 0,
    speed: 0,
  });

  // Update cooldowns from player state
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const newCooldowns: Record<SkillType, number> = {} as any;

      for (const skill of SKILL_LIST) {
        const skillId = skill.id as SkillType;
        const skillState = player.skills instanceof Map
          ? player.skills.get(skillId)
          : (player.skills as Record<SkillType, any>)[skillId];
        if (skillState) {
          const elapsed = now - skillState.lastUsed;
          const cooldownMs = skill.cooldown * 1000;
          const remaining = Math.max(0, cooldownMs - elapsed);
          newCooldowns[skill.id] = remaining;
        } else {
          newCooldowns[skill.id] = 0;
        }
      }

      setCooldowns(newCooldowns);
    }, 100);

    return () => clearInterval(interval);
  }, [player]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      const keyMap: Record<string, SkillType> = {
        '1': 'scan',
        '2': 'shield',
        '3': 'chain',
        '4': 'vision',
        '5': 'mark',
        '6': 'speed',
      };

      const skillId = keyMap[e.key];
      if (skillId && cooldowns[skillId] === 0) {
        handleUseSkill(skillId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cooldowns, handleUseSkill]);

  const onSkillClick = useCallback(
    (skillId: SkillType) => {
      if (cooldowns[skillId] === 0) {
        handleUseSkill(skillId);
      }
    },
    [cooldowns, handleUseSkill]
  );

  return (
    <div className="skillbar-container">
      {/* Background layer */}
      <div className="skillbar-bg" />

      {/* Skills */}
      <div className="skillbar-content">
        {SKILL_LIST.map((skill, index) => {
          const cooldown = cooldowns[skill.id];
          const isOnCooldown = cooldown > 0;
          const isActive = activeSkills.includes(skill.id);
          const cooldownPercent = isOnCooldown ? (cooldown / (skill.cooldown * 1000)) * 100 : 0;

          return (
            <div key={skill.id} className="skill-slot">
              <button
                className={`skill-button ${isActive ? 'active' : ''} ${isOnCooldown ? 'on-cooldown' : ''}`}
                onClick={() => onSkillClick(skill.id)}
                disabled={isOnCooldown}
                title={`${skill.name} (${index + 1})\n${skill.description}\nCooldown: ${skill.cooldown}s`}
              >
                {/* Cooldown fill */}
                {isOnCooldown && (
                  <div
                    className="skill-cooldown-fill"
                    style={{ height: `${cooldownPercent}%` }}
                  />
                )}

                {/* Inner glow layer */}
                <div className="skill-inner-layer" />

                {/* Icon */}
                <span className="skill-icon">{skill.emoji}</span>

                {/* Cooldown text */}
                {isOnCooldown && (
                  <span className="skill-cooldown-text">
                    {Math.ceil(cooldown / 1000)}
                  </span>
                )}

                {/* Active pulse ring */}
                {isActive && <div className="skill-active-ring" />}
              </button>

              {/* Hotkey badge */}
              <span className="skill-hotkey">{index + 1}</span>

              {/* Active indicator dot */}
              {isActive && <div className="skill-active-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
